// supabase/functions/stripe-webhook/index.ts
//
// PURPOSE: Receives and verifies Stripe webhook events. On a verified
//          checkout.session.completed event, creates the real purchase row
//          in the database, including the platform/seller split computed at
//          purchase time (locking in the commission rate that applied then).
//
// This is the ONLY path that creates paid purchase records — the client
// cannot insert them directly (purchases RLS only allows free inserts).
//
// Deferred payout model:
//   - platform_fee_cents and seller_amount_cents are computed and stored here.
//   - stripe_transfer_id is left NULL — the seller hasn't been paid yet.
//   - settle-pending-payouts transfers the seller's share once they connect Stripe.
//
// Security model:
//   - Every incoming request is verified against the Stripe webhook signing
//     secret (STRIPE_WEBHOOK_SECRET) before any processing occurs.
//     Requests with an invalid or missing signature are rejected with 400.
//   - Uses service role to bypass RLS for the insert.
//   - Idempotent: if a purchase row with the same stripe_payment_intent_id
//     already exists (e.g. Stripe retried the event), the insert is skipped.
//
// !! SETUP REQUIRED !!
// Webhook endpoint registered at:
//   https://wmnueemuldnhwzukckyi.supabase.co/functions/v1/stripe-webhook
// Listening for: checkout.session.completed, checkout.session.async_payment_succeeded,
//                customer.subscription.created, customer.subscription.updated,
//                customer.subscription.deleted
// Signing secret set via: npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Commission constant — change here only ────────────────────────────────────
// Stored per-purchase in platform_fee_cents so historical records are accurate
// even if this rate changes in the future.
const PLATFORM_COMMISSION_RATE = 0.05; // 5%

serve(async (req) => {
  // Stripe sends POST only — reject everything else
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeWebhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  // ── Signature verification — reject anything not from Stripe ─────────────
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: `Webhook error: ${err.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }

  // ── Route events ──────────────────────────────────────────────────────────
  // checkout.session.completed is routed on metadata.type:
  //   'boost'        -> paid product boost (create-boost-checkout)
  //   'subscription' -> Nothi Pro subscription (create-subscription-checkout)
  //   (none)         -> product purchase (create-checkout-session, legacy shape)
  try {
    if (event.type === 'checkout.session.async_payment_succeeded') {
      // Delayed payment methods (e.g. SEPA): completed arrives 'unpaid', the
      // money lands later with this event.
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === 'boost') await handleBoostPaid(session);
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const type = session.metadata?.type;
      if (type === 'boost') {
        await handleBoostPaid(session);
      } else if (type === 'subscription') {
        await handleSubscriptionCheckout(session, stripe);
      } else {
        await handleCheckoutSessionCompleted(session, stripe);
      }
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription, stripe);
    }
    // Other event types are acknowledged but not processed
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err.message);
    // Return 500 so Stripe will retry — but only for real server errors, not logic skips
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  // Acknowledge receipt to Stripe (must respond quickly to avoid retry)
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
});

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe  // used for fetching balance_transaction
) {
  const { product_id, buyer_id, seller_id, price_paid } = session.metadata ?? {};

  if (!product_id || !buyer_id || !seller_id || !price_paid) {
    console.error('checkout.session.completed missing required metadata:', session.metadata);
    // Don't throw — we don't want Stripe to retry a session with bad metadata
    return;
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // ── Idempotency check: skip if this PaymentIntent was already recorded ────
  // Stripe can retry webhook delivery — we must not create duplicate rows.
  // Primary guard: match on stripe_payment_intent_id (when available).
  // Fallback guard: match on (buyer_id, product_id, price_paid) for sessions
  // where payment_intent is null (some payment flows, or race conditions).
  if (paymentIntentId) {
    const { data: existing } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existing) {
      console.log(`Purchase already recorded for payment_intent ${paymentIntentId} — skipping`);
      return;
    }
  } else {
    // No payment_intent on this session — fall back to a best-effort check
    // using buyer + product + price to prevent duplicates on Stripe retries.
    const { data: existing } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('buyer_id', buyer_id)
      .eq('product_id', product_id)
      .eq('price_paid', parseFloat(price_paid))
      .is('stripe_payment_intent_id', null)
      .maybeSingle();

    if (existing) {
      console.log(`Duplicate purchase detected (null payment_intent) for buyer=${buyer_id} product=${product_id} — skipping`);
      return;
    }
  }

  // ── Fetch real Stripe processing fee ──────────────────────────────────────
  let stripeFeeCents = null;
  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction']
      });
      
      const balanceTransaction = (paymentIntent.latest_charge as any)?.balance_transaction;
      
      if (balanceTransaction && typeof balanceTransaction !== 'string') {
        stripeFeeCents = balanceTransaction.fee;
      } else {
        // If the balance transaction isn't fully propagated yet, throw to trigger a webhook retry
        throw new Error('Balance transaction not yet available on the payment intent');
      }
    } catch (err) {
      console.error(`Failed to retrieve Stripe fee for payment_intent ${paymentIntentId}:`, err);
      throw new Error(`Failed to retrieve Stripe fee: ${err.message}`);
    }
  }

  // ── Compute platform/seller split ─────────────────────────────────────────
  // Computed in cents and stored on the row so the rate is locked in at
  // purchase time — changing PLATFORM_COMMISSION_RATE won't alter history.
  const pricePaidFloat     = parseFloat(price_paid);
  const totalCents         = Math.round(pricePaidFloat * 100);
  const platformFeeCents   = Math.round(totalCents * PLATFORM_COMMISSION_RATE);
  // Seller absorbs the Stripe processing fee on top of the platform commission
  const sellerAmountCents  = totalCents - platformFeeCents - (stripeFeeCents || 0);

  // ── Insert the real, verified purchase row ────────────────────────────────
  // stripe_transfer_id intentionally omitted (stays NULL) — the seller's share
  // is pending until settle-pending-payouts runs after they connect Stripe.
  const { error } = await supabaseAdmin
    .from('purchases')
    .insert([{
      buyer_id,
      seller_id,
      product_id,
      price_paid:               pricePaidFloat,
      currency:                 session.currency?.toUpperCase() ?? 'USD',
      is_free:                  false,
      status:                   'completed',
      stripe_payment_intent_id: paymentIntentId,
      platform_fee_cents:       platformFeeCents,
      stripe_fee_cents:         stripeFeeCents,
      seller_amount_cents:      sellerAmountCents,
      // stripe_transfer_id: NULL — populated by settle-pending-payouts
    }]);

  if (error) {
    if (error.code === '23505') {
      // 23505 is PostgreSQL unique_violation. We hit the unique_buyer_product constraint.
      console.log(`Duplicate purchase blocked by DB constraint for buyer=${buyer_id} product=${product_id}`);
      return; // Acknowledge success to Stripe so it stops retrying this event
    }
    console.error('Failed to insert purchase:', error);
    // Throw so Stripe retries — this is a real server error, not a logic skip
    throw new Error(`Database insert failed: ${error.message}`);
  }

  console.log(
    `Purchase created: product=${product_id} buyer=${buyer_id} pi=${paymentIntentId} ` +
    `platform_fee=${platformFeeCents}¢ seller_amount=${sellerAmountCents}¢`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Paid boosts
// ─────────────────────────────────────────────────────────────────────────────
async function handleBoostPaid(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') {
    console.log(`Boost session ${session.id} not paid (${session.payment_status}) — skipping`);
    return;
  }
  const { seller_id, product_id, days } = session.metadata ?? {};
  if (!seller_id || !product_id || !days) {
    console.error('Boost session missing metadata:', session.metadata);
    return; // bad metadata: don't make Stripe retry forever
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // grant_paid_boost is idempotent on the checkout session id (Stripe retries).
  const { data, error } = await supabaseAdmin.rpc('grant_paid_boost', {
    p_seller_id: seller_id,
    p_product_id: product_id,
    p_days: parseInt(days, 10),
    p_session_id: session.id,
    p_amount_cents: session.amount_total ?? null,
  });

  if (error) {
    if (error.message?.includes('PRODUCT_NOT_FOUND')) {
      // Product deleted between payment and webhook — nothing to boost.
      // The payment should be refunded manually from the Stripe dashboard.
      console.error(`Paid boost for missing product ${product_id} (session ${session.id}) — needs manual refund`);
      return;
    }
    throw new Error(`grant_paid_boost failed: ${error.message}`);
  }
  console.log(`Boost applied: product=${product_id} days=${days} session=${session.id}`, data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pro subscription
// ─────────────────────────────────────────────────────────────────────────────
// Statuses that keep Pro active. past_due = Stripe is still retrying the card,
// so we keep the member's benefits during that grace period.
const PRO_STATUSES = ['active', 'trialing', 'past_due'];

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session, stripe: Stripe) {
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  if (!subscriptionId) {
    console.error(`Subscription checkout ${session.id} has no subscription id`);
    return;
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscription(subscription, stripe, session.metadata?.user_id ?? session.client_reference_id ?? undefined);
}

// Order-independent: Stripe does not deliver events in order, and a retried
// event carries a STALE copy of the subscription. So we never trust the event
// payload for the decision — we ask Stripe for ALL of this customer's
// subscriptions right now and derive the plan from the best one. Replaying any
// event, in any order, always converges to the same (correct) state.
async function syncSubscription(eventSub: Stripe.Subscription, stripe: Stripe, userIdHint?: string) {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const customerId = typeof eventSub.customer === 'string'
    ? eventSub.customer
    : eventSub.customer.id;

  // Resolve the profile: metadata first, then the saved Stripe customer id.
  let userId = eventSub.metadata?.user_id ?? userIdHint ?? null;
  if (!userId) {
    const { data: byCustomer } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    userId = byCustomer?.id ?? null;
  }
  if (!userId) {
    console.error(`No profile found for subscription ${eventSub.id} (customer ${customerId})`);
    return;
  }

  const { data: all } = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  const subs = all ?? [];
  const rank = (s: Stripe.Subscription) =>
    s.status === 'active' || s.status === 'trialing' ? 2 : s.status === 'past_due' ? 1 : 0;
  // Best = a Pro-granting one if any (active > past_due), newest first.
  const best = [...subs].sort((a, b) => rank(b) - rank(a) || b.created - a.created)[0] ?? eventSub;
  const isActive = PRO_STATUSES.includes(best.status);

  const item = best.items?.data?.[0];
  const periodEnd = (best as any).current_period_end ?? (item as any)?.current_period_end ?? null;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      plan: isActive ? 'pro' : 'free',
      stripe_customer_id: customerId,
      subscription_id: best.id,
      subscription_status: best.status,
      subscription_interval: item?.price?.recurring?.interval ?? null,
      subscription_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      subscription_cancel_at_period_end: best.cancel_at_period_end ?? false,
    })
    .eq('id', userId);

  if (error) throw new Error(`Failed to sync subscription: ${error.message}`);
  console.log(`Subscription synced: user=${userId} best=${best.id} status=${best.status} plan=${isActive ? 'pro' : 'free'} (event sub ${eventSub.id})`);
}
