// supabase/functions/create-subscription-checkout/index.ts
//
// PURPOSE: Start a Stripe Checkout session for the Nothi Pro subscription
//          (12 EUR / month or 99 EUR / year).
//
// Security model:
//   - Caller must be authenticated; the user id comes from the JWT, never the body.
//   - Prices are defined HERE (server-side) — the client only chooses 'month' | 'year'.
//   - This function never grants Pro. The plan only changes when the verified
//     stripe-webhook receives the subscription events from Stripe.
//
// Prices are looked up by `lookup_key` and created on first use, so the same
// code works unchanged in Stripe test mode and live mode (just swap the key).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keep in sync with src/config/plans.js (PRO_PRICING)
const PRO_PRODUCT_ID = 'nothi_pro';
const PRICES = {
  month: { lookupKey: 'nothi_pro_monthly_eur', unitAmount: 1200, interval: 'month' as const },
  year:  { lookupKey: 'nothi_pro_yearly_eur',  unitAmount: 9900, interval: 'year'  as const },
};

const ALLOWED_ORIGINS = [
  'https://nothiapp.noahthirion67.workers.dev',
  'https://redesign-nothiapp.noahthirion67.workers.dev',
  'http://localhost:5173',
];

function getAppUrl(req: Request): string {
  const origin = req.headers.get('origin') ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return Deno.env.get('APP_URL') ?? ALLOWED_ORIGINS[0];
}

async function getOrCreatePrice(stripe: Stripe, interval: 'month' | 'year'): Promise<string> {
  const cfg = PRICES[interval];
  const existing = await stripe.prices.list({ lookup_keys: [cfg.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  // Ensure the product exists (fixed id so we never create duplicates)
  try {
    await stripe.products.retrieve(PRO_PRODUCT_ID);
  } catch {
    await stripe.products.create({
      id: PRO_PRODUCT_ID,
      name: 'Nothi Pro',
      description: 'Unlimited products, 1 GB files, monthly boosts, advanced analytics, Pro badge.',
    });
  }

  const price = await stripe.prices.create({
    product: PRO_PRODUCT_ID,
    currency: 'eur',
    unit_amount: cfg.unitAmount,
    recurring: { interval: cfg.interval },
    lookup_key: cfg.lookupKey,
    transfer_lookup_key: true,
  });
  return price.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { interval } = await req.json();
    if (interval !== 'month' && interval !== 'year') throw new Error('Invalid interval');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, username, plan, stripe_customer_id, subscription_status')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) throw new Error('Profile not found');

    if (profile.plan === 'pro' && ['active', 'trialing', 'past_due'].includes(profile.subscription_status ?? '')) {
      throw new Error('already_subscribed');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Reuse the Stripe customer if it exists in the CURRENT Stripe mode.
    // (A customer id saved in test mode doesn't exist in live mode and vice versa.)
    let customerId: string | null = profile.stripe_customer_id ?? null;
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if ((c as Stripe.DeletedCustomer).deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? user.email ?? undefined,
        name: profile.username ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      const { error: saveError } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
      if (saveError) throw new Error(`Could not save customer: ${saveError.message}`);
    }

    // Source of truth is Stripe, not our DB (the webhook may not have landed
    // yet): never open a second checkout if a subscription already exists.
    const existingSubs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
    if (existingSubs.data.some((s) => ['active', 'trialing', 'past_due'].includes(s.status))) {
      throw new Error('already_subscribed');
    }

    const priceId = await getOrCreatePrice(stripe, interval);
    const appUrl = getAppUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { type: 'subscription', user_id: user.id },
      subscription_data: { metadata: { type: 'subscription', user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${appUrl}/dashboard/subscription?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('create-subscription-checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
