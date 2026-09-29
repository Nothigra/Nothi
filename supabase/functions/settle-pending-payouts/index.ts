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
//   4. Find all purchases WHERE seller_id = caller AND stripe_transfer_id IS NULL
//      AND seller_amount_cents > 0
//   5. For each, call stripe.transfers.create() then UPDATE the purchase row
//      with the resulting transfer ID. Each transfer is tied to the buyer's
//      original charge (`source_transaction`): without it, Stripe draws from
//      the platform's AVAILABLE balance and fails with "insufficient funds"
//      for any sale still inside Stripe's ~7-day settlement window. With it,
//      the transfer is accepted immediately and the money reaches the seller
//      as soon as that charge settles.
//   6. Return a summary: { settled: N, total_cents: X, not_ready: bool }
//
// Security model:
//   - Seller ID comes from the verified JWT — never from the request body.
//   - transfers capability checked live before every call — catches suspended accounts.
//   - Each transfer is followed immediately by setting stripe_transfer_id, making
//     the operation idempotent: a retry will skip already-transferred rows.
//   - Uses service role for DB reads/writes (purchases table is RLS-restricted).
//
// Trigger points:
//   - Automatically: DashboardPayouts.jsx calls this on stripe_return=1 redirect
//   - Manually:      "Request Payout" button in the Connected state of DashboardPayouts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      // No Stripe account at all — nothing to settle
      return new Response(
        JSON.stringify({ settled: 0, total_cents: 0, not_ready: true, reason: 'no_stripe_account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Live transfers-capability check ───────────────────────────────────────
    // Stripe may still be processing verification immediately after stripe_return.
    // If not ready, return gracefully — the seller can retry via "Request Payout".
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const stripeAccount = await stripe.accounts.retrieve(profile.stripe_account_id);

    const transfersActive = stripeAccount.capabilities?.transfers === 'active';
    if (!transfersActive) {
      return new Response(
        JSON.stringify({ settled: 0, total_cents: 0, not_ready: true, reason: 'transfers_not_ready' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch all unsettled purchases for this seller with a real seller payout
    // amount recorded (seller_amount_cents > 0). This mirrors the frontend's
    // Pending Balance query exactly. We read seller_amount_cents directly —
    // this function never recalculates splits; that is stripe-webhook's job.
    const { data: pendingPurchases, error: fetchError } = await supabaseAdmin
      .from('purchases')
      .select('id, seller_amount_cents, currency, stripe_payment_intent_id')
      .eq('seller_id', user.id)
      .is('stripe_transfer_id', null)
      .gt('seller_amount_cents', 0);

    if (fetchError) throw new Error(`Failed to fetch pending purchases: ${fetchError.message}`);

    if (!pendingPurchases || pendingPurchases.length === 0) {
      return new Response(
        JSON.stringify({ settled: 0, total_cents: 0, not_ready: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Transfer each pending purchase to the seller's connected account ────
    let settledCount = 0;
    let totalTransferredCents = 0;
    const errors: string[] = [];

    for (const purchase of pendingPurchases) {
      // seller_amount_cents is guaranteed > 0 by the query above.
      // Read it directly — no recalculation.
      const sellerCents = purchase.seller_amount_cents;

      try {
        // Tie the transfer to the buyer's charge (see header comment).
        // Only possible when that charge was in EUR; otherwise fall back to
        // the platform's available balance (older test purchases).
        let sourceCharge: string | undefined;
        if (purchase.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(purchase.stripe_payment_intent_id, {
            expand: ['latest_charge'],
          });
          const charge = pi.latest_charge as Stripe.Charge | null;
          if (charge && typeof charge !== 'string' && charge.status === 'succeeded'
              && charge.currency === 'eur' && charge.amount >= sellerCents) {
            sourceCharge = charge.id;
          }
        }

        const transfer = await stripe.transfers.create({
          amount:      sellerCents,
          currency:    'eur',
          destination: profile.stripe_account_id,
          ...(sourceCharge ? { source_transaction: sourceCharge } : {}),
          metadata: { purchase_id: purchase.id },
        }, {
          // Stable per purchase, on purpose: if an earlier attempt succeeded at
          // Stripe but the DB update below failed, retrying returns that SAME
          // transfer instead of paying the seller twice.
          idempotencyKey: `settle-${purchase.id}-eur-${sellerCents}`,
        });

        // Mark this purchase as settled
        const { error: updateError } = await supabaseAdmin
          .from('purchases')
          .update({ stripe_transfer_id: transfer.id })
          .eq('id', purchase.id);

        if (updateError) {
          console.error(`Transfer ${transfer.id} succeeded but DB update failed for purchase ${purchase.id}:`, updateError);
          errors.push(`purchase ${purchase.id}: DB update failed after transfer`);
        } else {
          settledCount++;
          totalTransferredCents += sellerCents;
        }
      } catch (transferErr) {
        console.error(`Transfer failed for purchase ${purchase.id}:`, transferErr.message);
        errors.push(`purchase ${purchase.id}: ${transferErr.message}`);
      }
    }

    console.log(
      `settle-pending-payouts: seller=${user.id} settled=${settledCount} ` +
      `total=${totalTransferredCents}¢ errors=${errors.length}`
    );

    return new Response(
      JSON.stringify({
        settled:      settledCount,
        total_cents:  totalTransferredCents,
        not_ready:    false,
        errors:       errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('settle-pending-payouts error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
