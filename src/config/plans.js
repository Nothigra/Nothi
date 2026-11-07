/**
 * Single source of truth for plans, limits and boost pricing on the client.
 *
 * IMPORTANT: these values are for DISPLAY only. Every limit is also enforced
 * server-side and the server is authoritative:
 *   - product count      -> DB trigger protect_product_privileged_columns
 *   - file size          -> Edge Function generate-product-file-upload-url
 *   - boost prices       -> Edge Function create-boost-checkout
 *   - Pro prices         -> Edge Function create-subscription-checkout
 *   - Pro boost packs    -> RPC activate_subscription_boost
 * If you change a number here, change it there too.
 */

export const PLAN_LIMITS = {
  free: { maxProducts: 30, maxFileSizeMB: 300 },
  pro: { maxProducts: Infinity, maxFileSizeMB: 1024 },
};

export const PRO_PRICING = {
  month: { amount: 12, label: 'per month' },
  year: { amount: 99, label: 'per year', monthlyEquivalent: 8.25, savingsPercent: 31 },
};

// One-off paid boosts (EUR)
export const BOOST_OPTIONS = [
  { days: 1, title: '24 Hours', price: 2.99 },
  { days: 3, title: '3 Days', price: 4.99, recommended: true },
  { days: 7, title: '7 Days', price: 6.99 },
];

// Pro monthly packs: the first boost used in a month locks the pack.
export const PRO_BOOST_PACKS = [
  { days: 1, count: 3, label: '3 × 24h' },
  { days: 3, count: 2, label: '2 × 3 days' },
  { days: 7, count: 1, label: '1 × 7 days' },
];

export const PRO_STATUSES = ['active', 'trialing', 'past_due'];

export function isPro(profile) {
  return profile?.plan === 'pro';
}

export function getPlanLimits(profile) {
  return isPro(profile) ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

export function formatFileSize(mb) {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

// ── Fees shown to sellers ─────────────────────────────────────────────────
// Keep in sync with the edge functions (stripe-webhook, paypal-payout).
export const PLATFORM_FEE_PCT = 5;
// What the buyer's payment costs (taken from the sale before the seller's share)
export const PAYMENT_FEES = {
  card: { label: 'Card', text: 'about 1.5% + €0.25 (Stripe)' },
  paypal: { label: 'PayPal', text: '0.2% + €0.10 (Stripe) + PayPal’s own fee' },
  local: { label: 'Other methods', text: 'Stripe’s rate for that method (Klarna, Alipay, Bancontact, UPI…)' },
  currency: { label: 'Foreign currency', text: 'Paid by the buyer (shown in their currency at checkout)' },
};
// What a payout costs the seller
export const PAYOUT_FEES = {
  stripe: { pct: 0, label: 'Stripe → your bank', text: 'Free for you — Nothi pays Stripe’s payout costs.', delay: '2–7 business days to your bank' },
  paypal: { pct: 2, label: 'PayPal', text: '2% of the amount, taken from the payout (PayPal’s payout fee).', delay: 'usually within minutes' },
};
export function payoutFeeCents(method, grossCents) {
  const pct = PAYOUT_FEES[method]?.pct || 0;
  return Math.round((grossCents * pct) / 100);
}
