import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Config ──
const PLATFORM_FEE_PERCENT = 0.05; // 5%
const STRIPE_FIXED_FEE = 25; // 0.25 EUR/USD in cents

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ── Middleware ──
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

// Raw body needed for Stripe webhooks
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    stripe: !!stripe,
    supabase: !!supabase,
    mode: stripe ? 'live' : 'mock',
  });
});

// ── Calculate Net Revenue ──
function calculateNet(priceInCents) {
  const commission = Math.round(priceInCents * PLATFORM_FEE_PERCENT);
  const net = priceInCents - commission - STRIPE_FIXED_FEE;
  return { gross: priceInCents, commission, stripeFee: STRIPE_FIXED_FEE, net: Math.max(net, 0) };
}

app.post('/api/calculate-revenue', (req, res) => {
  const { price } = req.body; // price in the product's currency (float)
  if (!price || price <= 0) return res.status(400).json({ error: 'Invalid price' });

  const priceInCents = Math.round(price * 100);
  const breakdown = calculateNet(priceInCents);

  res.json({
    gross: (breakdown.gross / 100).toFixed(2),
    commission: (breakdown.commission / 100).toFixed(2),
    stripeFee: (breakdown.stripeFee / 100).toFixed(2),
    net: (breakdown.net / 100).toFixed(2),
  });
});

// ── Create Checkout Session ──
app.post('/api/checkout', async (req, res) => {
  if (!stripe) {
    // Mock mode: return a fake success URL
    return res.json({
      url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/purchases?mock_checkout=success`,
      mock: true,
    });
  }

  const { productId, productTitle, priceInCents, currency, sellerId, buyerId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: productTitle },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/purchases?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/product/${productId}`,
      metadata: { productId, sellerId, buyerId },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Stripe Webhook ──
app.post('/api/webhook', async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(200).json({ received: true, mock: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], stripeWebhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { productId, sellerId, buyerId } = session.metadata;

    if (supabase) {
      // Record the order
      await supabase.from('orders').insert({
        buyer_id: buyerId,
        product_id: productId,
        seller_id: sellerId,
        amount: session.amount_total / 100,
        currency: session.currency.toUpperCase(),
        stripe_session_id: session.id,
        status: 'completed',
      });

      // Increment sales count
      await supabase.rpc('increment_sales', { product_id: productId });
    }
  }

  res.json({ received: true });
});

// ── Request Payout ──
app.post('/api/payout', async (req, res) => {
  if (!stripe || !supabase) {
    return res.json({
      success: true,
      mock: true,
      message: 'Payout request recorded (mock mode)',
    });
  }

  const { userId, amount, currency } = req.body;

  try {
    // Get seller's Stripe Connect account
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_account_id) {
      return res.status(400).json({ error: 'No Stripe account connected' });
    }

    // Create a transfer to the connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      destination: profile.stripe_account_id,
    });

    // Record the payout
    await supabase.from('payouts').insert({
      user_id: userId,
      amount,
      currency: currency.toUpperCase(),
      stripe_transfer_id: transfer.id,
      status: 'completed',
    });

    res.json({ success: true, transferId: transfer.id });
  } catch (err) {
    console.error('Payout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Connect Stripe Account (for sellers) ──
app.post('/api/connect/create', async (req, res) => {
  if (!stripe) {
    return res.json({ url: '#', mock: true });
  }

  const { userId, email } = req.body;

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      metadata: { userId },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/dashboard/payouts`,
      return_url: `${process.env.FRONTEND_URL}/dashboard/payouts?connected=true`,
      type: 'account_onboarding',
    });

    // Store account ID in profile
    if (supabase) {
      await supabase.from('profiles').update({
        stripe_account_id: account.id,
      }).eq('id', userId);
    }

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('Connect error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`\n  DigiLab API Server`);
  console.log(`  ─────────────────`);
  console.log(`  Port:     ${PORT}`);
  console.log(`  Stripe:   ${stripe ? '✓ Connected' : '✗ Mock mode (no key)'}`);
  console.log(`  Supabase: ${supabase ? '✓ Connected' : '✗ Mock mode (no key)'}`);
  console.log(`  Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log();
});
