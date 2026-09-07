// supabase/functions/get-stripe-account-status/index.ts
//
// PURPOSE: Returns the live Stripe account status for the authenticated seller.
//          Checks charges_enabled and details_submitted directly from Stripe API
//          so UI and checkout logic always reflect the real current state —
//          including if Stripe suspends/de-verifies an account after initial connection.
//
// Security model:
//   - Caller must be authenticated (JWT verified).
//   - stripe_account_id is read from the seller's own profile (service role),
//     never accepted from the client request body.
//   - Returns { charges_enabled: false } if seller has no stripe_account_id yet.

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

    // ── Load stripe_account_id from profile (service role bypasses RLS) ──────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Could not retrieve profile');

    // ── No Stripe account yet — return early ─────────────────────────────────
    if (!profile.stripe_account_id) {
      return new Response(
        JSON.stringify({ charges_enabled: false, details_submitted: false, transfers_active: false, transfers_status: 'inactive', stripe_account_id: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Fetch live status from Stripe ─────────────────────────────────────────
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const transfersCapability = account.capabilities?.transfers || 'inactive';

    return new Response(
      JSON.stringify({
        charges_enabled:   account.charges_enabled,
        details_submitted: account.details_submitted,
        transfers_active:  transfersCapability === 'active',
        transfers_status:  transfersCapability,
        stripe_account_id: account.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('get-stripe-account-status error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
