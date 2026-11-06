// supabase/functions/paypal-payout/index.ts
//
// PURPOSE: Pay a seller's available earnings to their PayPal account
//          (PayPal Payouts API), instead of a Stripe transfer.
//
// Same safety rules as settle-pending-payouts:
//   - Seller id from the verified JWT, never from the body.
//   - Only rows written by the verified stripe-webhook (paid, completed,
//     not yet settled) and older than PAYOUT_HOLD_DAYS.
//   - Each buyer charge is re-checked at Stripe (succeeded, EUR, not refunded,
//     not disputed) — the money must really be there.
//   - Rows are CLAIMED first (stripe_transfer_id = 'pppending:<payout id>'),
//     so two clicks can never pay twice. After PayPal accepts the payout they
//     become 'pp_<payout id>'. If PayPal clearly refuses, the claim is released.
//
// Fee: PayPal charges Nothi for each payout (PAYPAL_PAYOUT_FEE_PCT, default 2 %,
// optional cap PAYPAL_PAYOUT_FEE_CAP_CENTS). That fee is taken from the payout,
// and the seller sees it before asking.
//
// Money source: PayPal pays from Nothi's PayPal balance — keep it funded.
//
// Secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV ('sandbox' | 'live', default sandbox).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HOLD_DAYS = Number(Deno.env.get('PAYOUT_HOLD_DAYS') ?? '7');
const FEE_PCT = Number(Deno.env.get('PAYPAL_PAYOUT_FEE_PCT') ?? '2');
const FEE_CAP_CENTS = Number(Deno.env.get('PAYPAL_PAYOUT_FEE_CAP_CENTS') ?? '0'); // 0 = no cap
const MIN_PAYOUT_CENTS = 100;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });

function paypalBase() {
  return (Deno.env.get('PAYPAL_ENV') ?? 'sandbox') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalToken(): Promise<string> {
  const id = Deno.env.get('PAYPAL_CLIENT_ID') ?? '';
  const secret = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`paypal_auth_${res.status}`);
  return (await res.json()).access_token;
}

function payoutFee(grossCents: number): number {
  let fee = Math.round((grossCents * FEE_PCT) / 100);
  if (FEE_CAP_CENTS > 0) fee = Math.min(fee, FEE_CAP_CENTS);
  return fee;
}

function chargeProblem(charge: Stripe.Charge | string | null, sellerCents: number): string | null {
  if (!charge || typeof charge === 'string') return 'no_charge';
  if (charge.status !== 'succeeded') return `charge_${charge.status}`;
  if (charge.currency !== 'eur') return `charge_currency_${charge.currency}`;
  if (charge.refunded || (charge.amount_refunded ?? 0) > 0) return 'charge_refunded';
  if (charge.disputed) return 'charge_disputed';
  if (charge.amount < sellerCents) return 'charge_too_small';
  return null;
}


type PayoutRow = { id: string; net_cents: number; fee_cents: number; gross_cents: number; paypal_email: string };

// Sends (or re-sends, same PayPal-Request-Id = never twice) a payout and
// records the outcome on the claimed sales and the payout row.
async function sendAndFinish(
  // deno-lint-ignore no-explicit-any
  admin: SupabaseClient<any, 'public', any>, payout: PayoutRow, salesCount: number, base: Record<string, unknown>,
): Promise<Response> {
  const marker = `pppending:${payout.id}`;
  let ppStatus = 0;
  let ppBody: Record<string, unknown> = {};
  try {
    const token = await paypalToken();
    const res = await fetch(`${paypalBase()}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': payout.id,
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: payout.id,
          email_subject: 'You have a payout from Nothi',
          email_message: 'Your Nothi earnings have been sent to your PayPal account.',
        },
        items: [{
          recipient_type: 'EMAIL',
          receiver: payout.paypal_email,
          amount: { value: (payout.net_cents / 100).toFixed(2), currency: 'EUR' },
          note: 'Nothi earnings',
          sender_item_id: payout.id,
        }],
      }),
    });
    ppStatus = res.status;
    ppBody = await res.json().catch(() => ({}));
  } catch (err) {
    ppStatus = 0;
    ppBody = { message: (err as Error).message };
  }

  const nowIso = new Date().toISOString();
  if (ppStatus === 201 || ppStatus === 200) {
    const batchId = (ppBody.batch_header as Record<string, string> | undefined)?.payout_batch_id ?? null;
    await admin.from('purchases').update({ stripe_transfer_id: `pp_${payout.id}` }).eq('stripe_transfer_id', marker);
    await admin.from('paypal_payouts').update({ status: 'pending', paypal_batch_id: batchId, error: null, updated_at: nowIso }).eq('id', payout.id);
    return json({ settled: salesCount, total_cents: payout.net_cents, fee_cents: payout.fee_cents, gross_cents: payout.gross_cents, method: 'paypal', ...base });
  }

  const message = String((ppBody as { message?: string; name?: string }).message ?? (ppBody as { name?: string }).name ?? 'paypal_error');
  if (ppStatus >= 400 && ppStatus < 500) {
    // PayPal clearly refused: release the sales so they can be paid again
    await admin.from('purchases').update({ stripe_transfer_id: null }).eq('stripe_transfer_id', marker);
    await admin.from('paypal_payouts').update({ status: 'failed', error: message.slice(0, 300), updated_at: nowIso }).eq('id', payout.id);
    return json({ error: `paypal_refused: ${message}` }, 400);
  }
  // Network / PayPal 5xx: unknown outcome — keep the claim; the next request
  // re-sends the SAME payout (same PayPal-Request-Id), so it is never paid twice.
  await admin.from('paypal_payouts').update({ status: 'processing', error: message.slice(0, 300), updated_at: nowIso }).eq('id', payout.id);
  return json({ error: 'paypal_unreachable', payout_id: payout.id }, 502);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!Deno.env.get('PAYPAL_CLIENT_ID') || !Deno.env.get('PAYPAL_CLIENT_SECRET')) {
      return json({ not_configured: true });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: profile } = await admin
      .from('profiles')
      .select('id, paypal_email')
      .eq('id', user.id)
      .single();
    if (!profile?.paypal_email) return json({ error: 'no_paypal_email' }, 400);

    // A payout of this seller still waiting for PayPal? Don't start another.
    const { data: inFlight } = await admin
      .from('purchases')
      .select('id')
      .eq('seller_id', user.id)
      .like('stripe_transfer_id', 'pppending:%')
      .limit(1);
    if (inFlight && inFlight.length) {
      // An earlier payout never got PayPal's answer: send that same payout again.
      const { data: marked } = await admin
        .from('purchases')
        .select('stripe_transfer_id')
        .eq('seller_id', user.id)
        .like('stripe_transfer_id', 'pppending:%');
      const payoutId = String(marked?.[0]?.stripe_transfer_id ?? '').slice('pppending:'.length);
      const { data: row } = await admin.from('paypal_payouts').select('id, net_cents, fee_cents, gross_cents, paypal_email').eq('id', payoutId).single();
      if (!row) return json({ error: 'payout_in_progress' }, 409);
      return await sendAndFinish(admin, row as PayoutRow, marked?.length ?? 0, {});
    }

    const { data: unpaid, error: fetchError } = await admin
      .from('purchases')
      .select('id, seller_amount_cents, stripe_payment_intent_id, purchased_at')
      .eq('seller_id', user.id)
      .eq('status', 'completed')
      .eq('is_free', false)
      .not('stripe_payment_intent_id', 'is', null)
      .is('stripe_transfer_id', null)
      .gt('seller_amount_cents', 0);
    if (fetchError) throw new Error(fetchError.message);

    const releaseOf = (p: { purchased_at: string }) => new Date(p.purchased_at).getTime() + HOLD_DAYS * 86400000;
    const now = Date.now();
    const ready = (unpaid ?? []).filter((p) => releaseOf(p) <= now);
    const held = (unpaid ?? []).filter((p) => releaseOf(p) > now);
    const heldCents = held.reduce((s, p) => s + (p.seller_amount_cents || 0), 0);
    const nextReleaseAt = held.length ? new Date(Math.min(...held.map(releaseOf))).toISOString() : null;

    // Re-check every buyer charge at Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });
    const payable: { id: string; cents: number }[] = [];
    const skipped: { purchase_id: string; reason: string }[] = [];
    for (const p of ready) {
      const pi = await stripe.paymentIntents.retrieve(p.stripe_payment_intent_id, { expand: ['latest_charge'] });
      const problem = chargeProblem(pi.latest_charge as Stripe.Charge | null, p.seller_amount_cents);
      if (problem) skipped.push({ purchase_id: p.id, reason: problem });
      else payable.push({ id: p.id, cents: p.seller_amount_cents });
    }

    const gross = payable.reduce((s, p) => s + p.cents, 0);
    const base = { held_cents: heldCents, held_count: held.length, hold_days: HOLD_DAYS, next_release_at: nextReleaseAt, skipped: skipped.length ? skipped : undefined };
    if (gross < MIN_PAYOUT_CENTS) return json({ settled: 0, total_cents: 0, ...base, below_minimum: gross > 0 });

    const fee = payoutFee(gross);
    const net = gross - fee;

    // Create the payout record, then claim the rows for it
    const { data: payout, error: payoutError } = await admin
      .from('paypal_payouts')
      .insert({ seller_id: user.id, gross_cents: gross, fee_cents: fee, net_cents: net, paypal_email: profile.paypal_email })
      .select('id')
      .single();
    if (payoutError || !payout) throw new Error('could_not_start_payout');

    const marker = `pppending:${payout.id}`;
    const { data: claimed } = await admin
      .from('purchases')
      .update({ stripe_transfer_id: marker })
      .in('id', payable.map((p) => p.id))
      .is('stripe_transfer_id', null)
      .select('id, seller_amount_cents');
    const claimedCents = (claimed ?? []).reduce((s, p) => s + (p.seller_amount_cents || 0), 0);
    if (!claimed || claimed.length === 0 || claimedCents !== gross) {
      // Something changed in between (another payout?): undo and stop.
      await admin.from('purchases').update({ stripe_transfer_id: null }).eq('stripe_transfer_id', marker);
      await admin.from('paypal_payouts').update({ status: 'failed', error: 'changed_during_claim', updated_at: new Date().toISOString() }).eq('id', payout.id);
      return json({ error: 'please_retry' }, 409);
    }

    return await sendAndFinish(admin, { id: payout.id, net_cents: net, fee_cents: fee, gross_cents: gross, paypal_email: profile.paypal_email }, claimed.length, base);
  } catch (error) {
    console.error('paypal-payout error:', error);
    return json({ error: (error as Error).message }, 400);
  }
});
