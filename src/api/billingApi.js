import { supabase, invokeFunction, withTimeoutSafety, isMockMode } from '../lib/supabase';

/**
 * Billing API — every call that touches money goes through an Edge Function or
 * a SECURITY DEFINER RPC. The client never writes plan / boost / balance data.
 */

// Translate server error codes into messages a seller can act on.
const ERROR_MESSAGES = {
  NOT_PRO: 'This feature is part of Nothi Pro.',
  QUOTA_EXHAUSTED: "You've used all your Pro boosts for this month.",
  PRODUCT_NOT_PUBLISHED: 'Only published products can be boosted.',
  PRODUCT_NOT_FOUND: 'Product not found.',
  INVALID_DURATION: 'Invalid boost duration.',
  already_subscribed: "You're already a Pro member.",
  no_customer: 'No billing account yet — subscribe to Pro first.',
};

export function billingErrorMessage(err) {
  const raw = err?.message || String(err || '');
  if (raw.startsWith('PACK_LOCKED')) {
    const days = raw.split(':')[1];
    const label = days === '1' ? '24h' : `${days}-day`;
    return `This month you've chosen the ${label} pack. You can pick another pack next month.`;
  }
  const key = Object.keys(ERROR_MESSAGES).find((k) => raw.includes(k));
  return key ? ERROR_MESSAGES[key] : raw || 'Something went wrong. Please try again.';
}

/** Redirects to Stripe Checkout for Nothi Pro. interval: 'month' | 'year' */
export async function startProCheckout(interval) {
  const { url } = await invokeFunction('create-subscription-checkout', { interval });
  if (!url) throw new Error('Could not start checkout');
  window.location.assign(url);
}

/** Opens Stripe's customer portal (change plan, card, invoices, cancel). */
export async function openBillingPortal() {
  const { url } = await invokeFunction('create-billing-portal-session');
  if (!url) throw new Error('Could not open billing portal');
  window.location.assign(url);
}

/** Redirects to Stripe Checkout for a one-off paid boost. */
export async function startBoostCheckout(productId, days) {
  const { url } = await invokeFunction('create-boost-checkout', { productId, days });
  if (!url) throw new Error('Could not start checkout');
  window.location.assign(url);
}

/** Uses one boost from the Pro monthly pack. Returns { boosted_until, remaining, pack_days }. */
export async function activateProBoost(productId, days) {
  const { data, error } = await withTimeoutSafety(() =>
    supabase.rpc('activate_subscription_boost', { p_product_id: productId, p_days: days })
  );
  if (error) throw new Error(error.message);
  return data;
}

/** { is_pro, pack_days, used, allowance, remaining, resets_at } */
export async function getBoostQuota() {
  if (isMockMode) return null;
  const { data, error } = await withTimeoutSafety(() => supabase.rpc('get_my_boost_quota'));
  if (error) throw new Error(error.message);
  return data;
}

/** Pro-only analytics bundle (server checks the plan). */
export async function getAdvancedAnalytics(days = 30) {
  const { data, error } = await withTimeoutSafety(() =>
    supabase.rpc('get_advanced_analytics', { p_days: days })
  );
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Seller earnings — the single source of truth for every money figure shown
 * in the seller dashboard (Overview, Withdrawals...). Computed from the
 * purchase rows written by the verified stripe-webhook, never from
 * profiles.balance (which no real payment ever updates).
 *
 * All values are in EUR cents:
 *   grossCents       what buyers paid (before any fee)
 *   feesCents        Nothi commission + Stripe processing fees
 *   netCents         the seller's share (gross - fees)
 *   pendingCents     net share not yet transferred to the seller's Stripe account
 *   transferredCents net share already transferred
 *   paidSales        number of paid sales (free claims excluded)
 */
export const EMPTY_EARNINGS = {
  grossCents: 0, feesCents: 0, netCents: 0,
  pendingCents: 0, transferredCents: 0, paidSales: 0,
};

export async function getSellerEarnings(sellerId) {
  if (!sellerId || isMockMode) return { ...EMPTY_EARNINGS };

  const { data, error } = await withTimeoutSafety(() =>
    supabase
      .from('purchases')
      .select('price_paid, seller_amount_cents, stripe_transfer_id')
      .eq('seller_id', sellerId)
      .eq('status', 'completed')
      .gt('price_paid', 0)
  );
  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    const gross = Math.round(Number(row.price_paid || 0) * 100);
    const net = Math.max(0, Number(row.seller_amount_cents || 0));
    acc.grossCents += gross;
    acc.netCents += net;
    acc.feesCents += gross - net;
    if (row.stripe_transfer_id) acc.transferredCents += net;
    else acc.pendingCents += net;
    acc.paidSales += 1;
    return acc;
  }, { ...EMPTY_EARNINGS });
}
