// supabase/functions/create-boost-checkout/index.ts
//
// PURPOSE: Stripe Checkout for a one-off paid boost (24h / 3 days / 7 days).
//          Pro members use their monthly pack via the activate_subscription_boost
//          RPC instead, but can also buy extra boosts here.
//
// Security model:
//   - Authenticated caller; seller id from JWT.
//   - Caller must own the product, and it must be published.
//   - Price comes from the server-side table below, never from the client.
//   - The boost is only applied by stripe-webhook after Stripe confirms payment
//     (grant_paid_boost, idempotent on the checkout session id).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keep in sync with src/config/plans.js (BOOST_OPTIONS)
const BOOST_PRICES: Record<number, { cents: number; label: string }> = {
  1: { cents: 299, label: '24 hours' },
  3: { cents: 499, label: '3 days' },
  7: { cents: 699, label: '7 days' },
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

function productName(title: unknown): string {
  if (typeof title === 'string') {
    try {
      const parsed = JSON.parse(title);
      if (parsed && typeof parsed === 'object') return parsed.en ?? Object.values(parsed)[0] ?? 'your product';
    } catch { /* plain string */ }
    return title;
  }
  if (title && typeof title === 'object') {
    const t = title as Record<string, string>;
    return t.en ?? Object.values(t)[0] ?? 'your product';
  }
  return 'your product';
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

    const { productId, days } = await req.json();
    const option = BOOST_PRICES[Number(days)];
    if (!productId || !option) throw new Error('Invalid boost request');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, title, seller_id, status')
      .eq('id', productId)
      .single();

    if (productError || !product) throw new Error('Product not found');
    if (product.seller_id !== user.id) throw new Error('Forbidden: you do not own this product');
    if (product.status !== 'published') throw new Error('Only published products can be boosted');

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const appUrl = getAppUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: option.cents,
          product_data: { name: `Boost ${option.label} — ${productName(product.title)}` },
        },
        quantity: 1,
      }],
      customer_email: user.email ?? undefined,
      // NOTE: no buyer_id here on purpose — the webhook routes on `type`.
      metadata: {
        type: 'boost',
        seller_id: user.id,
        product_id: product.id,
        days: String(days),
      },
      success_url: `${appUrl}/dashboard/products?boost=success`,
      cancel_url: `${appUrl}/dashboard/products?boost=cancelled`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('create-boost-checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
