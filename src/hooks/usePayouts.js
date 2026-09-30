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
  const [loadingTransfers, setLoadingTransfers] = useState(true);

  useEffect(() => {
    const fetchTransfers = async () => {
      if (!profile?.id || isMockMode) {
        setLoadingTransfers(false);
        return;
      }
      const { data } = await withTimeoutSafety(() =>
        supabase
          .from('purchases')
          .select('id, purchased_at, seller_amount_cents, stripe_transfer_id, product:products(title)')
          .eq('seller_id', profile.id)
          .like('stripe_transfer_id', 'tr_%') // real transfers only, not in-flight claims
          .order('purchased_at', { ascending: false })
      ).catch((err) => {
        console.error('Error fetching transfers:', err);
        return { data: null };
      });

      if (data) setTransfers(data);
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

  const handleRequestPayout = async () => {
    setIsSettling(true);
    setStripeMessage(null);
    try {
      const data = await invokeFunction('settle-pending-payouts');
      if (data?.error) throw new Error(data.error);
      const failed = data?.errors?.length || 0;
      const held = data?.skipped?.length || 0;
      const heldNote = held
        ? ` ${held} sale${held === 1 ? ' is' : 's are'} on hold (refunded, disputed or needing a manual check) and ${held === 1 ? 'was' : 'were'} not transferred.`
        : '';
      if (data?.not_ready) {
        setStripeMessage({ type: 'warning', text: 'Your Stripe account isn\'t fully verified yet. Please check back in a few minutes.' });
      } else if (data?.settled > 0) {
        setStripeMessage({
          type: failed ? 'warning' : 'success',
          text: `${formatEur(data.total_cents / 100)} sent to your Stripe account. Money from recent sales becomes available once Stripe settles the payment (up to ~7 days).`
            + (failed ? ` ${failed} sale${failed === 1 ? '' : 's'} could not be transferred — please try again later.` : '')
            + heldNote,
        });
        setEarningsReload((n) => n + 1);
      } else if (failed) {
        console.error('settle-pending-payouts errors:', data.errors);
        setStripeMessage({ type: 'error', text: `The transfer failed for ${failed} sale${failed === 1 ? '' : 's'}. Please try again later or contact support.` });
        setEarningsReload((n) => n + 1);
      } else if (held) {
        setStripeMessage({ type: 'warning', text: `Nothing was transferred.${heldNote} Contact support if this looks wrong.` });
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

  return { balance, earnings, formatEur, formatPrice, handleConnectStripe, handleManageStripe, handleMax, handleRequestPayout, handleWithdraw, hasStripeAccount, isDetailsSubmitted, isFullyConnected, isManagingStripe, isPendingVerify, isProcessing, isSettling, isTransfersActive, loadingTransfers, message, pendingBalanceCents, profile, stripeConnecting, stripeMessage, stripeStatus, stripeStatusLoading, transfers, withdrawAmount, setWithdrawAmount, setStripeMessage, setMessage };
}
