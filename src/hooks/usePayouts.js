/**
 * usePayouts — seller payout state and actions (Stripe Connect onboarding,
 * Express dashboard link, settle-pending-payouts, transfer history).
 * Shared by the website page (DashboardPayouts) and the app screen (AppPayoutsPage).
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { supabase, withTimeoutSafety, invokeFunction, isMockMode } from '../lib/supabase';
import { getSellerEarnings, EMPTY_EARNINGS } from '../api/billingApi';
import { isNativePlatform, openExternal } from '../lib/native';

export function usePayouts() {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const [statusReload, setStatusReload] = useState(0);
  const { formatPrice, formatEur } = useCurrency();
  const location = useLocation();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeMessage, setStripeMessage] = useState(null);
  const [isManagingStripe, setIsManagingStripe] = useState(false);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(false);
  // Real earnings from purchase rows (EUR cents). null = still loading.
  const [earnings, setEarnings] = useState(null);
  const [earningsReload, setEarningsReload] = useState(0);
  const pendingBalanceCents = isMockMode ? (profile?.balance || 0) : (earnings ? earnings.pendingCents : null);
  const [isSettling, setIsSettling] = useState(false);
  const [transfers, setTransfers] = useState([]);
  // Where the seller wants to be paid: 'stripe' (bank) or 'paypal'
  const [payoutMethod, setPayoutMethodState] = useState(profile?.payout_method || 'stripe');
  const [paypalEmail, setPaypalEmail] = useState(profile?.paypal_email || '');
  const [isSavingPayout, setIsSavingPayout] = useState(false);
  useEffect(() => {
    if (profile?.payout_method) setPayoutMethodState(profile.payout_method);
    if (profile?.paypal_email != null) setPaypalEmail(profile.paypal_email || '');
  }, [profile?.payout_method, profile?.paypal_email]);
  const [loadingTransfers, setLoadingTransfers] = useState(true);

  useEffect(() => {
    const fetchTransfers = async () => {
      if (!profile?.id || isMockMode) {
        setLoadingTransfers(false);
        return;
      }
      const [{ data }, { data: pp }] = await Promise.all([
        withTimeoutSafety(() =>
          supabase
            .from('purchases')
            .select('id, purchased_at, seller_amount_cents, stripe_transfer_id, product:products(title)')
            .eq('seller_id', profile.id)
            .like('stripe_transfer_id', 'tr_%') // real transfers only, not in-flight claims
            .order('purchased_at', { ascending: false })
        ).catch((err) => { console.error('Error fetching transfers:', err); return { data: null }; }),
        withTimeoutSafety(() =>
          supabase
            .from('paypal_payouts')
            .select('id, created_at, net_cents, fee_cents, status')
            .eq('seller_id', profile.id)
            .neq('status', 'failed')
            .order('created_at', { ascending: false })
        ).catch(() => ({ data: null })),
      ]);

      const rows = [
        ...(data || []).map((t) => ({ id: t.id, date: t.purchased_at, cents: t.seller_amount_cents, method: 'Stripe', status: 'completed' })),
        ...(pp || []).map((p) => ({ id: p.id, date: p.created_at, cents: p.net_cents, feeCents: p.fee_cents, method: 'PayPal', status: p.status === 'success' || p.status === 'pending' ? 'sent' : p.status })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransfers(rows);
      setLoadingTransfers(false);
    };
    fetchTransfers();
  }, [profile?.id, isMockMode, earningsReload]);

  // Mock mode only: simulated balance (real mode never uses profiles.balance)
  const balance = (profile?.balance || 0) / 100;

  // Derived charge-readiness signals — based on LIVE Stripe data, not just ID presence.
  const hasStripeAccount  = !!profile?.stripe_account_id;
  // Onboarding form finished (Stripe may still be reviewing it)
  const isDetailsSubmitted = stripeStatus?.details_submitted === true;
  const isTransfersActive = stripeStatus?.transfers_active === true;
  // Sellers only RECEIVE transfers from Nothi; they never charge cards
  // themselves, so the `transfers` capability is what makes them payable.
  const isFullyConnected  = isTransfersActive;
  const isPendingVerify   = hasStripeAccount && !isFullyConnected;

  // Fetch live Stripe account status on mount
  useEffect(() => {
    if (!profile?.stripe_account_id) return;
    setStripeStatusLoading(true);
    invokeFunction('get-stripe-account-status')
      .then((data) => {
        if (data && !data.error) setStripeStatus(data);
      })
      .catch(() => {/* non-fatal — UI stays in loading state */})
      .finally(() => setStripeStatusLoading(false));
  }, [profile?.stripe_account_id, statusReload]);

  // Fetch real earnings (same source as the Overview page)
  useEffect(() => {
    if (!profile?.id || isMockMode) return;
    let cancelled = false;
    getSellerEarnings(profile.id)
      .then((e) => { if (!cancelled) setEarnings(e); })
      .catch((err) => {
        console.error('Error fetching earnings:', err);
        if (!cancelled) setEarnings({ ...EMPTY_EARNINGS });
      });
    return () => { cancelled = true; };
  }, [profile?.id, earningsReload]);

  // Handle Stripe's redirect back to this page after onboarding
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('stripe_return') === '1') {
      window.history.replaceState({}, '', location.pathname);
      // Attempt to settle pending payouts now that the seller has connected.
      // charges_enabled may not be true yet — settle-pending-payouts handles
      // this gracefully and returns not_ready:true if so. Seller can retry
      // via 'Request Payout' button once Stripe finishes verification.
      invokeFunction('settle-pending-payouts')
        .then((data) => {
          if (data?.not_ready) {
            setStripeMessage({ type: 'success', text: 'Stripe account connected! Your pending earnings will be transferred once Stripe completes verification — click "Request Payout" to check.' });
          } else if (data?.settled > 0) {
            setStripeMessage({ type: 'success', text: `Stripe account connected! ${formatEur(data.total_cents / 100)} in pending earnings has been transferred to your account.` });
            setEarningsReload((n) => n + 1);
          } else {
            setStripeMessage({ type: 'success', text: 'Your Stripe account is connected! Future sales will be transferred automatically.' });
          }
        })
        .catch(() => {
          setStripeMessage({ type: 'success', text: 'Your Stripe account is connected! Click "Request Payout" to transfer your pending earnings.' });
        });
    }
    if (params.get('stripe_refresh') === '1') {
      window.history.replaceState({}, '', location.pathname);
      setStripeMessage({ type: 'warning', text: 'Your Stripe onboarding link expired. Please click below to continue.' });
    }
  }, [location.search]);

  const handleConnectStripe = async () => {
    setStripeConnecting(true);
    setStripeMessage(null);
    try {
      const data = await invokeFunction('create-stripe-connect-account');
      if (data?.error) throw new Error(data.error);
      if (isNativePlatform) {
        // App: Stripe onboarding runs in the in-app browser; when the seller
        // closes it, pick up the new account + its verification status.
        await openExternal(data.url, { onClose: async () => { await refreshProfile?.(); setStatusReload((n) => n + 1); setEarningsReload((n) => n + 1); } });
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error('Stripe connect error:', err);
      setStripeMessage({ type: 'error', text: err.message || 'Failed to start Stripe onboarding. Please try again.' });
    } finally {
      setStripeConnecting(false);
    }
  };

  // For already-connected sellers: opens the real Stripe Express Dashboard
  // (balance, payout history, bank settings) — NOT the onboarding flow.
  // Uses create-stripe-login-link which calls stripe.accounts.createLoginLink().
  const handleManageStripe = async () => {
    setIsManagingStripe(true);
    setStripeMessage(null);
    try {
      const data = await invokeFunction('create-stripe-login-link');
      if (data?.error) throw new Error(data.error);
      await openExternal(data.url, { onClose: () => setStatusReload((n) => n + 1) });
    } catch (err) {
      console.error('Stripe login link error:', err);
      setStripeMessage({ type: 'error', text: err.message || 'Failed to open Stripe Dashboard. Please try again.' });
    } finally {
      setIsManagingStripe(false);
    }
  };

  const savePayoutSettings = async ({ method, email }) => {
    setIsSavingPayout(true);
    setStripeMessage(null);
    try {
      const patch = {};
      if (method) patch.payout_method = method;
      if (email !== undefined) {
        const clean = String(email || '').trim().toLowerCase();
        if (clean && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Please enter a valid PayPal email address.');
        patch.paypal_email = clean || null;
      }
      const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
      if (error) throw error;
      if (method) setPayoutMethodState(method);
      if (email !== undefined) setStripeMessage({ type: 'success', text: patch.paypal_email ? 'PayPal email saved.' : 'PayPal email removed.' });
      refreshProfile?.();
    } catch (err) {
      setStripeMessage({ type: 'error', text: err.message || 'Could not save. Please try again.' });
    } finally {
      setIsSavingPayout(false);
    }
  };

  const handleRequestPayout = async () => {
    setIsSettling(true);
    setStripeMessage(null);
    try {
      const viaPaypal = payoutMethod === 'paypal';
      const data = await invokeFunction(viaPaypal ? 'paypal-payout' : 'settle-pending-payouts');
      if (data?.not_configured) throw new Error('PayPal payouts are not available yet. Please use Stripe for now.');
      if (data?.error === 'no_paypal_email') throw new Error('Add your PayPal email first.');
      if (data?.error === 'payout_in_progress') throw new Error('A PayPal payout is already on its way. Please wait a moment.');
      if (data?.error) throw new Error(String(data.error).replace(/^paypal_refused: /, 'PayPal refused the payout: '));
      if (viaPaypal && data?.settled > 0) {
        setStripeMessage({
          type: 'success',
          text: `${formatEur(data.total_cents / 100)} sent to your PayPal (${formatEur((data.gross_cents || 0) / 100)} minus ${formatEur((data.fee_cents || 0) / 100)} PayPal fee).`,
        });
        setEarningsReload((n) => n + 1);
        return;
      }
      if (viaPaypal && data?.below_minimum) {
        setStripeMessage({ type: 'warning', text: `PayPal payouts start at ${formatEur(1)}. Sell a bit more and try again.` });
        return;
      }
      const failed = data?.errors?.length || 0;
      const held = data?.skipped?.length || 0;
      const heldNote = held
        ? ` ${held} sale${held === 1 ? ' is' : 's are'} on hold (refunded, disputed or needing a manual check) and ${held === 1 ? 'was' : 'were'} not transferred.`
        : '';
      // Sales are paid out after a short holding period (refunds/chargebacks)
      const waitNote = data?.held_cents > 0
        ? ` ${formatEur(data.held_cents / 100)} from your latest sales will be ready on ${new Date(data.next_release_at).toLocaleDateString(document.documentElement.lang || 'en', { day: 'numeric', month: 'long' })} (sales are paid out ${data.hold_days} days after purchase).`
        : '';
      if (data?.not_ready) {
        setStripeMessage({ type: 'warning', text: 'Your Stripe account isn\'t fully verified yet. Please check back in a few minutes.' });
      } else if (data?.settled > 0) {
        setStripeMessage({
          type: failed ? 'warning' : 'success',
          text: `${formatEur(data.total_cents / 100)} sent to your Stripe account. Money from recent sales becomes available once Stripe settles the payment (up to ~7 days).`
            + (failed ? ` ${failed} sale${failed === 1 ? '' : 's'} could not be transferred — please try again later.` : '')
            + heldNote + waitNote,
        });
        setEarningsReload((n) => n + 1);
      } else if (failed) {
        console.error('settle-pending-payouts errors:', data.errors);
        setStripeMessage({ type: 'error', text: `The transfer failed for ${failed} sale${failed === 1 ? '' : 's'}. Please try again later or contact support.` });
        setEarningsReload((n) => n + 1);
      } else if (held) {
        setStripeMessage({ type: 'warning', text: `Nothing was transferred.${heldNote}${waitNote} Contact support if this looks wrong.` });
      } else if (data?.held_cents > 0) {
        setStripeMessage({ type: 'success', text: `Nothing to transfer yet.${waitNote}` });
      } else {
        setStripeMessage({ type: 'success', text: 'No pending earnings to transfer right now.' });
      }
    } catch (err) {
      setStripeMessage({ type: 'error', text: err.message || 'Payout request failed. Please try again.' });
    } finally {
      setIsSettling(false);
    }
  };

  const handleWithdraw = async () => {
    // Real mode: money only moves through Stripe (settle-pending-payouts).
    // The balance-editing flow below is a mock-mode simulation only.
    if (!isMockMode) {
      await handleRequestPayout();
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount.' });
      return;
    }
    if (amount > balance) {
      setMessage({ type: 'error', text: 'Insufficient balance.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    // MOCK: simulate withdrawal processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newBalance = Math.round((balance - amount) * 100); // back to cents
    await updateProfile({ balance: newBalance });
    setWithdrawAmount('');
    setIsProcessing(false);
    setMessage({ type: 'success', text: `Successfully withdrew ${formatPrice(amount)}. Funds will arrive in 3-5 business days.` });
  };

  const handleMax = () => {
    setWithdrawAmount(balance.toString());
  };

  return { payoutMethod, paypalEmail, setPaypalEmail, savePayoutSettings, isSavingPayout, balance, earnings, formatEur, formatPrice, handleConnectStripe, handleManageStripe, handleMax, handleRequestPayout, handleWithdraw, hasStripeAccount, isDetailsSubmitted, isFullyConnected, isManagingStripe, isPendingVerify, isProcessing, isSettling, isTransfersActive, loadingTransfers, message, pendingBalanceCents, profile, stripeConnecting, stripeMessage, stripeStatus, stripeStatusLoading, transfers, withdrawAmount, setWithdrawAmount, setStripeMessage, setMessage };
}
