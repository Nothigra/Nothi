// supabase/functions/create-stripe-connect-account/index.ts
//
// PURPOSE: Creates a Stripe Express connected account for a seller (if one
//          doesn't already exist) and returns a short-lived hosted onboarding URL.
//
// Security model:
//   - Caller must be authenticated (JWT verified).
//   - Uses the seller's verified user ID from the JWT — never trusts client-supplied IDs.
//   - If the seller already has a stripe_account_id, skips creation and generates
//     a fresh Account Link (lets them re-enter onboarding if incomplete).
//   - Return/refresh URLs follow the caller's origin (prod, redesign preview
//     or localhost) from an allow-list, falling back to the APP_URL secret.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // ── Load seller profile via service role (bypasses RLS) ──────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Could not retrieve seller profile');

    // ── Stripe client ────────────────────────────────────────────────────────
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── Create or reuse Stripe Express account ───────────────────────────────
    let stripeAccountId = profile.stripe_account_id;

    // An account id saved in Stripe test mode doesn't exist in live mode (and
    // vice versa): start a fresh account instead of failing forever.
    if (stripeAccountId) {
      try {
        await stripe.accounts.retrieve(stripeAccountId);
      } catch (err) {
        if ((err as { code?: string })?.code === 'resource_missing' ||
            (err as { statusCode?: number })?.statusCode === 404) {
          stripeAccountId = null;
        } else {
          throw err;
        }
      }
    }

    if (!stripeAccountId) {
      // First time: create a new Express connected account
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { supabase_user_id: user.id },
      });

      stripeAccountId = account.id;

      // Persist the new account ID immediately so we can re-enter onboarding
      // if the seller closes the tab before finishing — prevents duplicate accounts.
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to save stripe_account_id:', updateError);
        // Non-fatal: we still return the link so onboarding can proceed.
      }
    }

    // ── Generate hosted onboarding Account Link ──────────────────────────────
    // refresh_url: called if the link expires mid-flow
    // return_url:  called after seller completes (or exits) onboarding
    const appUrl = getAppUrl(req);

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/dashboard/payouts?stripe_refresh=1`,
      return_url:  `${appUrl}/dashboard/payouts?stripe_return=1`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ url: accountLink.url, stripeAccountId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('create-stripe-connect-account error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
