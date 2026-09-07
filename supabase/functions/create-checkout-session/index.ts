// supabase/functions/create-checkout-session/index.ts
//
// PURPOSE: Creates a Stripe Checkout Session for a single paid product purchase.
//          The platform collects the FULL charge on its own Stripe account.
//          No Connect split happens at charge time — the seller's share is computed
//          and stored in the DB by stripe-webhook, then transferred later by
//          settle-pending-payouts once the seller connects and verifies their account.
//          This is the "separate charges and transfers" / deferred payout model.
//
// Security model:
//   - Caller must be authenticated (JWT verified). Buyer ID comes from JWT, never client body.
//   - Fetches product price + seller_id server-side — client cannot spoof price or seller.
//   - Free products (price = 0) must NOT call this function — they use the direct insert path.
//   - No purchase row is created here. The stripe-webhook function creates it on
//     checkout.session.completed — this is the real security boundary.
//   - Sellers do NOT need a connected Stripe account for buyers to purchase from them.
//     Verification is deferred to payout time.
//
// !! PRODUCTION TODO !!
// Set APP_URL secret before going live:
//   npx supabase secrets set APP_URL=https://yourdomain.com
// Without this, success/cancel redirects send buyers to localhost.

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
    // ── Auth: verify buyer from JWT ───────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // ── Parse request body ────────────────────────────────────────────────────
    const { productId } = await req.json();
    if (!productId) throw new Error('Missing productId');

    // ── Fetch product server-side (price cannot be spoofed by client) ─────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch from raw products table (not public view) so we get seller_id + status
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, title, price, seller_id, status')
      .eq('id', productId)
      .single();

    if (productError || !product) throw new Error('Product not found');
    if (product.status !== 'published') throw new Error('Product is not available for purchase');
    if (product.price <= 0) throw new Error('Use the free download path for free products');

    // Prevent self-purchasing (consistent with DB no_self_purchasing constraint)
    if (product.seller_id === user.id) throw new Error('You cannot purchase your own product');

    // Prevent re-purchasing an already owned product
    const { data: existingPurchase } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('product_id', productId)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingPurchase) {
      throw new Error('already_purchased');
    }

    // ── Create Stripe Checkout Session ────────────────────────────────────────
    // Full charge goes to the platform's own Stripe account.
    // No application_fee_amount or transfer_data — the Connect split is deferred.
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'; // !! PRODUCTION TODO: set APP_URL secret

    const totalCents = Math.round(product.price * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',

      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: totalCents,
          product_data: {
            name: typeof product.title === 'string'
              ? product.title
              : (product.title?.en ?? 'Digital Product'),
          },
        },
        quantity: 1,
      }],

      // Embed all fields needed by stripe-webhook to create the purchase row
      // and compute the platform/seller split.
      metadata: {
        product_id: product.id,
        buyer_id:   user.id,
        seller_id:  product.seller_id,
        price_paid: product.price.toString(),
      },

      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/checkout/cancel`,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('create-checkout-session error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
