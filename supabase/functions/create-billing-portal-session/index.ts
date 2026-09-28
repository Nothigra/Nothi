// supabase/functions/create-billing-portal-session/index.ts
//
// PURPOSE: Open Stripe's hosted Customer Portal so a Pro member can change
//          plan (monthly <-> yearly), update their card, see invoices or cancel.
//
// Security model: authenticated caller only; the Stripe customer id is read
// server-side from the caller's own profile, never from the request body.
//
// !! SETUP !! The Customer Portal must be activated once per Stripe mode:
//   Dashboard -> Settings -> Billing -> Customer portal -> Save.

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) throw new Error('no_customer');

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // A customer saved in Stripe test mode doesn't exist in live mode.
    try {
      const c = await stripe.customers.retrieve(profile.stripe_customer_id);
      if ((c as Stripe.DeletedCustomer).deleted) throw new Error('deleted');
    } catch {
      throw new Error('no_customer');
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getAppUrl(req)}/dashboard/subscription`,
    });

    return new Response(
      JSON.stringify({ url: portal.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('create-billing-portal-session error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
