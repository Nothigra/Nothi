// supabase/functions/settle-pending-payouts/index.ts
//
// PURPOSE: Transfers accumulated pending seller earnings to their connected
//          Stripe Express account. Called after a seller completes onboarding.
//
// Flow:
//   1. Verify caller's JWT (seller must be authenticated — we use their own user ID)
//   2. Fetch their stripe_account_id from profile (service role)
//   3. Live-check the `transfers` capability from Stripe (account may not be
//      ready yet right after the stripe_return redirect — handled gracefully).
//      Only `transfers` matters here: the seller receives transfers, they
//      never charge cards themselves, so charges_enabled is irrelevant.
//   4. Recover rows left "in flight" by an earlier run that crashed (see below).
//   5. For each unsettled PAID purchase:
//        a. Check the buyer's charge at Stripe. Only a succeeded, EUR,
//           un-refunded, un-disputed charge covering the seller amount is paid.
//           Anything else is SKIPPED and reported — never paid out of the
//           platform's own balance.
//        b. CLAIM the row: stripe_transfer_id = 'pending:<unix seconds>' with a
//           conditional update (WHERE stripe_transfer_id IS NULL). Only one run
//           can claim a row, and a claimed row is never paid again.
//        c. Create the transfer tied to that charge (`source_transaction`):
//           without it Stripe draws from the platform's AVAILABLE balance and
//           fails for any sale still inside the ~7-day settlement window.
//        d. Replace the marker with the real transfer id.
//   6. Return { settled, total_cents, skipped, not_ready, errors }.
//
// Why the claim marker: Stripe idempotency keys expire after 24h. If a
// transfer succeeded but saving its id failed, a retry the next day would pay
// the seller twice. With the marker, the row stays claimed; step 4 later looks
// the transfer up at Stripe (via the charge's transfer_group + metadata.purchase_id)
// and either records it or,
// if Stripe has no such transfer, releases the row for a new attempt.
//
// Security model:
//   - Seller ID comes from the verified JWT — never from the request body.
//   - transfers capability checked live before every call — catches suspended accounts.
//   - Only rows written by the verified stripe-webhook are paid (is_free = false
//     AND a stripe_payment_intent_id) — clients cannot write those columns
//     (migration 020), and the amount is re-checked against the real charge.
//   - Uses service role for DB reads/writes (purchases table is RLS-restricted).
//
// Trigger points:
//   - Automatically: DashboardPayouts.jsx calls this on stripe_return=1 redirect
//   - Manually:      "Request Payout" button in the Connected state of DashboardPayouts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MARKER_PREFIX = 'pending:';
// A claimed row older than this whose transfer can't be found is released.
const STALE_MARKER_SECONDS = 15 * 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });

// Find the transfer created for a purchase (metadata.purchase_id), if any.
// Searched through the buyer's CHARGE, not the seller's current account: a
// transfer made with source_transaction shares the charge's transfer_group
// (Stripe sets it to 'group_<payment_intent>' when the charge had none), so
// this still finds it if the seller's Stripe account changed since.
async function findTransferForPurchase(
  stripe: Stripe, purchaseId: string, paymentIntentId: string | null,
): Promise<Stripe.Transfer | null> {
  if (!paymentIntentId) return null;
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  const charge = pi.latest_charge as Stripe.Charge | null;
  const groups = new Set<string>([`group_${pi.id}`]);
  if (charge && typeof charge !== 'string' && charge.transfer_group) groups.add(charge.transfer_group);

  for (const transfer_group of groups) {
    for await (const t of stripe.transfers.list({ transfer_group, limit: 100 })) {
      if (t.metadata?.purchase_id === purchaseId) return t;
    }
  }
  return null;
}

// Step 4: resolve rows claimed by a run that never finished.
async function recoverStaleClaims(
  supabaseAdmin: SupabaseClient, stripe: Stripe, sellerId: string, errors: string[],
) {
  const { data: claimed } = await supabaseAdmin
    .from('purchases')
    .select('id, stripe_transfer_id, stripe_payment_intent_id')
    .eq('seller_id', sellerId)
    .like('stripe_transfer_id', `${MARKER_PREFIX}%`);

  const now = Math.floor(Date.now() / 1000);
  for (const row of claimed ?? []) {
    const claimedAt = Number(String(row.stripe_transfer_id).slice(MARKER_PREFIX.length)) || 0;
    if (now - claimedAt < STALE_MARKER_SECONDS) continue; // may still be running

    try {
      const transfer = await findTransferForPurchase(stripe, row.id, row.stripe_payment_intent_id);
      await supabaseAdmin
        .from('purchases')
        .update({ stripe_transfer_id: transfer ? transfer.id : null })
        .eq('id', row.id)
        .eq('stripe_transfer_id', row.stripe_transfer_id);
      console.log(`settle: recovered claim on ${row.id} -> ${transfer ? transfer.id : 'released'}`);
    } catch (err) {
      errors.push(`purchase ${row.id}: could not recover earlier claim (${(err as Error).message})`);
    }
  }
}

// Step 5a: is this charge safe to pay the seller from?
function chargeProblem(charge: Stripe.Charge | string | null, sellerCents: number): string | null {
  if (!charge || typeof charge === 'string') return 'no_charge';
  if (charge.status !== 'succeeded') return `charge_${charge.status}`;
  if (charge.currency !== 'eur') return `charge_currency_${charge.currency}`;
  if (charge.refunded || (charge.amount_refunded ?? 0) > 0) return 'charge_refunded';
  if (charge.disputed) return 'charge_disputed';
  if (charge.amount < sellerCents) return 'charge_too_small';
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth: verify seller from JWT ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // ── Fetch seller profile (stripe_account_id) ──────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Could not retrieve seller profile');

    if (!profile.stripe_account_id) {
      return json({ settled: 0, total_cents: 0, not_ready: true, reason: 'no_stripe_account' });
    }

    // ── Live transfers-capability check ───────────────────────────────────────
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const stripeAccount = await stripe.accounts.retrieve(profile.stripe_account_id);
    if (stripeAccount.capabilities?.transfers !== 'active') {
      return json({ settled: 0, total_cents: 0, not_ready: true, reason: 'transfers_not_ready' });
    }

    const destination = profile.stripe_account_id;
    const errors: string[] = [];
    const skipped: { purchase_id: string; reason: string }[] = [];

    // ── 4. Recover rows left claimed by an interrupted run ───────────────────
    await recoverStaleClaims(supabaseAdmin, stripe, user.id, errors);

    // ── 5. Unsettled PAID purchases written by the verified webhook ──────────
    const { data: pendingPurchases, error: fetchError } = await supabaseAdmin
      .from('purchases')
      .select('id, seller_amount_cents, stripe_payment_intent_id')
      .eq('seller_id', user.id)
      .eq('status', 'completed')
      .eq('is_free', false)
      .not('stripe_payment_intent_id', 'is', null)
      .is('stripe_transfer_id', null)
      .gt('seller_amount_cents', 0);

    if (fetchError) throw new Error(`Failed to fetch pending purchases: ${fetchError.message}`);

    let settledCount = 0;
    let totalTransferredCents = 0;

    for (const purchase of pendingPurchases ?? []) {
      const sellerCents: number = purchase.seller_amount_cents;
      let marker: string | null = null;

      try {
        // a. The buyer's charge must be safe to pay from
        const pi = await stripe.paymentIntents.retrieve(purchase.stripe_payment_intent_id, {
          expand: ['latest_charge'],
        });
        const charge = pi.latest_charge as Stripe.Charge | null;
        const problem = chargeProblem(charge, sellerCents);
        if (problem) {
          skipped.push({ purchase_id: purchase.id, reason: problem });
          continue;
        }

        // b. Claim the row (only one run can win)
        marker = `${MARKER_PREFIX}${Math.floor(Date.now() / 1000)}`;
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from('purchases')
          .update({ stripe_transfer_id: marker })
          .eq('id', purchase.id)
          .is('stripe_transfer_id', null)
          .select('id');
        if (claimError) throw new Error(`claim failed: ${claimError.message}`);
        if (!claimed || claimed.length === 0) { marker = null; continue; } // another run has it

        // c. Transfer, tied to the buyer's charge
        const transfer = await stripe.transfers.create({
          amount: sellerCents,
          currency: 'eur',
          destination,
          source_transaction: (charge as Stripe.Charge).id,
          metadata: { purchase_id: purchase.id },
        }, {
          idempotencyKey: `settle-${purchase.id}-eur-${sellerCents}`,
        });

        // d. Record it (marker stays if this fails -> recovered on a later run)
        const { error: saveError } = await supabaseAdmin
          .from('purchases')
          .update({ stripe_transfer_id: transfer.id })
          .eq('id', purchase.id)
          .eq('stripe_transfer_id', marker);
        if (saveError) {
          console.error(`Transfer ${transfer.id} succeeded but saving it failed for ${purchase.id}:`, saveError);
        }
        settledCount++;
        totalTransferredCents += sellerCents;
      } catch (err) {
        const e = err as { message?: string; statusCode?: number; type?: string };
        console.error(`Transfer failed for purchase ${purchase.id}:`, e.message);
        errors.push(`purchase ${purchase.id}: ${e.message}`);
        // Release the claim only when Stripe definitely rejected the transfer
        // (4xx). On network/5xx errors we can't know — keep the claim and let
        // recoverStaleClaims check Stripe later.
        const definitelyRejected = typeof e.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 500;
        if (marker && definitelyRejected) {
          await supabaseAdmin
            .from('purchases')
            .update({ stripe_transfer_id: null })
            .eq('id', purchase.id)
            .eq('stripe_transfer_id', marker);
        }
      }
    }

    console.log(
      `settle-pending-payouts: seller=${user.id} settled=${settledCount} ` +
      `total=${totalTransferredCents}¢ skipped=${skipped.length} errors=${errors.length}`
    );
    if (skipped.length) console.warn('settle-pending-payouts skipped:', JSON.stringify(skipped));

    return json({
      settled:     settledCount,
      total_cents: totalTransferredCents,
      not_ready:   false,
      skipped:     skipped.length > 0 ? skipped : undefined,
      errors:      errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('settle-pending-payouts error:', error);
    return json({ error: (error as Error).message }, 400);
  }
});
