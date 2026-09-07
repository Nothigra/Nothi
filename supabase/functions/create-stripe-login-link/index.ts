// supabase/functions/create-stripe-login-link/index.ts
//
// PURPOSE: Generates a Stripe Express login link for a seller who has already
//          connected and verified their Stripe account. This drops them directly
//          into their Stripe Express Dashboard (real balance, payout history,
//          bank account settings) — NOT the onboarding flow.
//
// This is intentionally separate from create-stripe-connect-account, which
// always generates an account_onboarding link. Using a login link for already-
// verified sellers avoids showing them the onboarding shell again.
//
// Security model:
//   - Caller must be authenticated (JWT verified).
//   - stripe_account_id is read from the caller's own profile (service role)
//     — never accepted from the client request body.
//   - Errors if the caller has no stripe_account_id (call create-stripe-connect-account instead).

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
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // ── Fetch stripe_account_id from profile (service role bypasses RLS) ──────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Could not retrieve seller profile');

    if (!profile.stripe_account_id) {
      throw new Error('No Stripe account found. Please connect your Stripe account first.');
    }

    // ── Generate Express Dashboard login link ─────────────────────────────────
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);

    return new Response(
      JSON.stringify({ url: loginLink.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('create-stripe-login-link error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
