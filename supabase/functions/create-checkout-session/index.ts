// supabase/functions/create-checkout-session/index.ts
//
// PURPOSE: Creates ONE Stripe Checkout Session for every paid product in the
//          buyer's cart (any number of sellers). The platform collects the FULL
//          charge on its own Stripe account; stripe-webhook then creates one
//          purchase row per product with its own platform/seller split, and
//          settle-pending-payouts later transfers each seller's share
//          ("separate charges and transfers" / deferred payout model).
//
// Request body: { productIds: string[] }   (or the legacy { productId })
//
// Security model:
//   - Caller must be authenticated (JWT verified). Buyer ID comes from JWT, never client body.
//   - Prices, sellers and availability are read server-side — the client only
//     sends product ids. The charged price is the active promotion price when
//     there is one (public_products.sale_price), otherwise the regular price.
//   - Free products (price = 0) are not accepted here — they use the free-claim path.
//   - The cart snapshot is stored in checkout_carts (service role only) and the
//     session only carries its id. No purchase row is created here: the
//     verified stripe-webhook does that once the payment is confirmed.
//   - Sellers do NOT need a connected Stripe account for buyers to purchase from them.

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

const MAX_ITEMS = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAppUrl(req: Request): string {
  const origin = req.headers.get('origin') ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return Deno.env.get('APP_URL') ?? ALLOWED_ORIGINS[0];
}

function productName(title: unknown): string {
  if (typeof title === 'string') return title.slice(0, 250) || 'Digital Product';
  const t = title as Record<string, string> | null;
  return (t?.en ?? t?.fr ?? Object.values(t ?? {})[0] ?? 'Digital Product').slice(0, 250);
}

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
    const body = await req.json();
    const rawIds: unknown[] = Array.isArray(body?.productIds)
      ? body.productIds
      : (body?.productId ? [body.productId] : []);
    const productIds = [...new Set(rawIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id)))];
    if (productIds.length === 0) throw new Error('Missing productId');
    if (productIds.length > MAX_ITEMS) throw new Error(`too_many_items:${MAX_ITEMS}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Products, server-side (raw table: status + seller_id) ─────────────────
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, title, price, seller_id, status')
      .in('id', productIds);
    if (productsError) throw new Error('Could not read products');

    // Active promotion prices — ONE definition: public.active_sale_price()
    const { data: publicRows, error: saleError } = await supabaseAdmin
      .from('public_products')
      .select('id, sale_price')
      .in('id', productIds);
    if (saleError) throw new Error('Could not read product prices');
    const saleById = new Map((publicRows ?? []).map((r) => [r.id, r.sale_price]));

    // Already owned by this buyer → left out of the payment
    const { data: owned } = await supabaseAdmin
      .from('purchases')
      .select('product_id')
      .eq('buyer_id', user.id)
      .in('product_id', productIds);
    const ownedIds = new Set((owned ?? []).map((r) => r.product_id));

    const items: { product_id: string; seller_id: string; price_cents: number; name: string }[] = [];
    const skipped: { product_id: string; reason: string }[] = [];

    for (const id of productIds) {
      const p = (products ?? []).find((x) => x.id === id);
      if (!p || p.status !== 'published') { skipped.push({ product_id: id, reason: 'unavailable' }); continue; }
      if (Number(p.price) <= 0) { skipped.push({ product_id: id, reason: 'free' }); continue; }
      if (p.seller_id === user.id) { skipped.push({ product_id: id, reason: 'own_product' }); continue; }
      if (ownedIds.has(id)) { skipped.push({ product_id: id, reason: 'already_purchased' }); continue; }

      const sale = saleById.get(id);
      const charged = sale != null ? Number(sale) : Number(p.price);
      items.push({
        product_id: p.id,
        seller_id: p.seller_id,
        price_cents: Math.round(charged * 100),
        name: productName(p.title),
      });
    }

    if (items.length === 0) {
      // Keep the historical single-product error codes for the UI.
      const reason = skipped.length === 1 ? skipped[0].reason : 'nothing_to_pay';
      if (reason === 'own_product') throw new Error('You cannot purchase your own product');
      throw new Error(reason);
    }

    const totalCents = items.reduce((sum, i) => sum + i.price_cents, 0);

    // ── Snapshot the cart (service role only) ─────────────────────────────────
    const { data: cart, error: cartError } = await supabaseAdmin
      .from('checkout_carts')
      .insert({
        buyer_id: user.id,
        items: items.map(({ product_id, seller_id, price_cents }) => ({ product_id, seller_id, price_cents })),
        total_cents: totalCents,
      })
      .select('id')
      .single();
    if (cartError || !cart) throw new Error('Could not start checkout');

    // ── Stripe Checkout Session ───────────────────────────────────────────────
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const appUrl = getAppUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items.map((i) => ({
        price_data: {
          currency: 'eur',
          unit_amount: i.price_cents,
          product_data: { name: i.name },
        },
        quantity: 1,
      })),
      client_reference_id: user.id,
      metadata: {
        type: 'cart',
        checkout_id: cart.id,
        buyer_id: user.id,
      },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/checkout/cancel`,
    });

    await supabaseAdmin
      .from('checkout_carts')
      .update({ stripe_session_id: session.id })
      .eq('id', cart.id);

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
        productIds: items.map((i) => i.product_id),
        skipped: skipped.length ? skipped : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('create-checkout-session error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
