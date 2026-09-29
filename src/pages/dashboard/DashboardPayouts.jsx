import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { 
  DollarSign, ArrowUpRight, Clock, CheckCircle2, AlertCircle, 
  Landmark, ArrowRight, Wallet, History, FileText, ExternalLink,
  AlertTriangle, ChevronRight, Download, HelpCircle, Info, Lock, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { supabase, withTimeoutSafety, invokeFunction, isMockMode } from '../../lib/supabase';
import CurrencyInput from '../../components/ui/CurrencyInput';
import { getSellerEarnings, EMPTY_EARNINGS } from '../../api/billingApi';
import './DashboardPages.css';
import { isNativePlatform, openExternal } from '../../lib/native';

export default function DashboardPayouts() {
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

  return (
    <div className="dashboard-page pb-2xl">
      <div className="dashboard-page-header">
        <div>
          <h1 className="dashboard-title">Financial Dashboard</h1>
          <p className="dashboard-subtitle">Manage your earnings, payouts, and financial history.</p>
        </div>
      </div>

      {isMockMode ? (
      <div className="stats-grid mb-xl" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Available Balance</p>
          <h3 className="text-3xl font-bold font-display text-primary">{formatPrice(balance)}</h3>
          <p className="text-sm text-secondary mt-sm">Ready to withdraw (demo)</p>
        </div>
      </div>
      ) : (
      <div className="stats-grid mb-xl" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">To Be Transferred</p>
          <h3 className="text-3xl font-bold font-display text-primary">
            {earnings === null ? '…' : formatEur(earnings.pendingCents / 100)}
          </h3>
          <p className="text-sm text-secondary mt-sm flex items-center gap-xs">
            {isFullyConnected
              ? <><CheckCircle2 size={14} className="text-success" /> Ready to transfer</>
              : <><Clock size={14} /> Connect Stripe to receive</>}
          </p>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Total Transferred</p>
          <h3 className="text-3xl font-bold font-display text-primary">
            {earnings === null ? '…' : formatEur(earnings.transferredCents / 100)}
          </h3>
          <p className="text-sm text-secondary mt-sm flex items-center gap-xs"><CheckCircle2 size={14} className="text-success" /> Sent to your Stripe account</p>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Net Earnings</p>
          <h3 className="text-3xl font-bold font-display text-primary">
            {earnings === null ? '…' : formatEur(earnings.netCents / 100)}
          </h3>
          <p className="text-sm text-secondary mt-sm">Your share, after fees</p>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Gross Sales</p>
          <h3 className="text-3xl font-bold font-display text-primary">
            {earnings === null ? '…' : formatEur(earnings.grossCents / 100)}
          </h3>
          <p className="text-sm text-secondary mt-sm">
            {earnings === null ? '' : `${earnings.paidSales} paid sale${earnings.paidSales === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl mb-xl">
        {isMockMode ? (
        <>
        {/* Withdraw Form */}
        <div className="settings-card m-0 lg:col-span-2 flex flex-col">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base flex items-center gap-sm"><Wallet size={18} /> Request Withdrawal</h3>
          </div>
          <div className="card-body pt-xl">
            {message && (
              <div className={`alert mb-lg ${message.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                color: message.type === 'error' ? '#ef4444' : '#10b981',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                fontSize: '14px',
              }}>
                <div className="mt-[2px]">{message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}</div>
                <div>
                  <h4 className="font-semibold mb-xs">{message.type === 'error' ? 'Withdrawal Failed' : 'Withdrawal Initiated'}</h4>
                  <p className="opacity-90 leading-snug">{message.text}</p>
                </div>
              </div>
            )}

            <div className="mb-xl max-w-md">
              <div className="flex gap-sm">
                <div className="flex-1">
                  <CurrencyInput
                    label="Amount to Withdraw"
                    placeholder="0.00"
                    min="0"
                    max={balance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                </div>
                <button 
                  className="btn btn-outline"
                  style={{ height: '56px' }}
                  onClick={handleMax}
                >
                  MAX
                </button>
              </div>
              <div className="flex justify-between mt-sm text-sm">
                <span className="text-secondary">Minimum withdrawal: $20.00</span>
                <span className="text-accent font-medium">Remaining: {formatPrice(Math.max(0, balance - (parseFloat(withdrawAmount) || 0)))}</span>
              </div>
            </div>

            <div className="pt-lg border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
              <div className="mb-sm sm:mb-0">
                <p className="text-sm font-medium">Estimated Arrival</p>
                <p className="text-xs text-secondary">{new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()} - {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
              </div>
              <button
                className="btn btn-primary px-2xl py-md text-base shadow-lg hover:-translate-y-1 transition-transform"
                onClick={handleWithdraw}
                disabled={isProcessing || balance < 20 || !withdrawAmount || parseFloat(withdrawAmount) < 20}
              >
                {isProcessing ? (
                  <><Clock size={18} className="spin mr-sm" /> Processing...</>
                ) : (
                  <>Withdraw {withdrawAmount ? `$${parseFloat(withdrawAmount).toFixed(2)}` : ''}</>
                )}
              </button>
            </div>
          </div>
        </div>

        </>
        ) : (
        <>
        {/* Earnings breakdown (real mode) — money only moves through Stripe */}
        <div className="settings-card m-0 lg:col-span-2 flex flex-col">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base flex items-center gap-sm"><Wallet size={18} /> Earnings Breakdown</h3>
          </div>
          <div className="card-body pt-xl">
            {earnings === null ? (
              <p className="text-sm text-secondary">Loading…</p>
            ) : (
              <div className="flex flex-col gap-sm max-w-md">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Gross sales</span>
                  <span className="font-medium">{formatEur(earnings.grossCents / 100)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Nothi commission (5%) + Stripe fees</span>
                  <span className="font-medium text-danger">-{formatEur(earnings.feesCents / 100)}</span>
                </div>
                <div className="flex justify-between text-sm pt-sm border-t border-border">
                  <span className="font-semibold">Net earnings</span>
                  <span className="font-bold">{formatEur(earnings.netCents / 100)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Already transferred</span>
                  <span className="font-medium">{formatEur(earnings.transferredCents / 100)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Waiting to be transferred</span>
                  <span className="font-bold text-accent">{formatEur(earnings.pendingCents / 100)}</span>
                </div>
              </div>
            )}

            <div className="mt-xl p-md bg-bg-tertiary rounded-lg text-sm text-secondary leading-snug flex items-start gap-sm">
              <Info size={16} className="shrink-0 mt-[2px]" />
              <span>
                Your share of each sale is kept safely until your Stripe account is connected and verified.
                Then click <strong>Request Payout</strong>: the money is sent to your Stripe account, and Stripe
                pays it out to your bank automatically. All amounts are in euros (EUR).
              </span>
            </div>
          </div>
        </div>

        </>
        )}

        {/* Stripe Connect — Payout Method */}
        <div className="settings-card m-0 flex flex-col">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base flex items-center gap-sm"><Landmark size={18} /> Payout Method</h3>
          </div>
          <div className="card-body pt-xl">

            {/* Stripe message banner */}
            {stripeMessage && (
              <div className="mb-lg" style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: stripeMessage.type === 'error' ? 'rgba(239,68,68,0.1)' : stripeMessage.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                color: stripeMessage.type === 'error' ? '#ef4444' : stripeMessage.type === 'warning' ? '#f59e0b' : '#10b981',
                display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px',
              }}>
                {stripeMessage.type === 'error' && <AlertCircle size={16} />}
                {stripeMessage.type === 'warning' && <AlertTriangle size={16} />}
                {stripeMessage.type === 'success' && <CheckCircle2 size={16} />}
                {stripeMessage.text}
              </div>
            )}

            {isFullyConnected ? (
              /* ── Fully connected + charge-ready + transfers-active ── */
              <>
                <div className="payout-method-card">
                  <div className="payout-method-info">
                    <div className="payout-method-icon">
                      <Landmark size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-primary">Stripe Express Account</h4>
                      <p className="text-xs text-secondary mt-[2px]" style={{ fontFamily: 'monospace' }}>{profile.stripe_account_id}</p>
                    </div>
                  </div>
                  <div className="badge badge-success text-xs px-sm py-[2px] rounded-full">Connected</div>
                </div>

                <button
                  className="btn btn-outline w-full mt-lg text-sm flex-center gap-sm"
                  onClick={handleManageStripe}
                  disabled={isManagingStripe}
                >
                  {isManagingStripe ? (
                    <><div className="loader spin" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Opening Stripe...</>
                  ) : (
                    <><ExternalLink size={14} /> Manage in Stripe Dashboard</>
                  )}
                </button>

                {/* Request Payout button — triggers settle-pending-payouts manually */}
                {pendingBalanceCents > 0 && (
                  <button
                    className="btn btn-primary w-full mt-sm flex-center gap-sm"
                    onClick={handleRequestPayout}
                    disabled={isSettling}
                  >
                    {isSettling ? (
                      <><div className="loader spin" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Transferring...</>
                    ) : (
                      <><ArrowUpRight size={14} /> Request Payout ({formatEur(pendingBalanceCents / 100)})</>
                    )}
                  </button>
                )}

                <div className="mt-xl p-md bg-bg-tertiary rounded-lg text-sm text-secondary leading-snug">
                  <span className="font-medium text-primary block mb-xs">Tax Information</span>
                  Ensure your W-9 / W-8BEN forms are up to date in Stripe to avoid withholding taxes.
                </div>
              </>
            ) : isPendingVerify ? (
              /* ── Account created but Stripe hasn't verified yet ── */
              <>
                <div className="payout-method-card" style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
                  <div className="payout-method-info">
                    <div className="payout-method-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      <Landmark size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-primary">Stripe Express Account</h4>
                      <p className="text-xs text-secondary mt-[2px]" style={{ fontFamily: 'monospace' }}>{profile.stripe_account_id}</p>
                    </div>
                  </div>
                  <div className="badge text-xs px-sm py-[2px] rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Pending Verification</div>
                </div>

                <div className="p-md rounded-xl mt-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <div className="flex items-start gap-sm">
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Verification in progress</p>
                      <p className="text-xs text-secondary mt-xs">
                        {isDetailsSubmitted
                          ? "Stripe is reviewing your details, or needs more information before it can send you transfers."
                          : "Your Stripe account was created but onboarding isn't complete yet. Complete verification to receive your pending earnings."}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary w-full mt-lg flex-center gap-sm"
                  onClick={isDetailsSubmitted ? handleManageStripe : handleConnectStripe}
                  disabled={stripeConnecting || isManagingStripe}
                >
                  {stripeConnecting || isManagingStripe ? (
                    <><div className="loader spin" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Redirecting...</>
                  ) : (
                    <><ExternalLink size={16} /> {isDetailsSubmitted ? "Check Requirements in Stripe" : "Complete Stripe Onboarding"}</>
                  )}
                </button>
              </>
            ) : (
              /* ── No Stripe account yet ── */
              <>
                <p className="text-sm text-secondary mb-lg">Connect your Stripe account to receive your pending earnings and future payouts. Stripe handles all payment processing and transfers directly to your bank.</p>

                {pendingBalanceCents > 0 && (
                  <div className="p-md rounded-xl mb-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div className="flex items-center gap-sm">
                      <DollarSign size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatEur(pendingBalanceCents / 100)} in pending earnings</span> — connect Stripe to receive this.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-primary w-full flex-center gap-sm"
                  onClick={handleConnectStripe}
                  disabled={stripeConnecting || stripeStatusLoading}
                >
                  {stripeConnecting ? (
                    <><div className="loader spin" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Redirecting to Stripe...</>
                  ) : (
                    <><ExternalLink size={16} /> Connect Stripe Account</>
                  )}
                </button>

                <p className="text-xs text-secondary text-center mt-md">You'll be redirected to Stripe's secure onboarding. Takes about 2 minutes.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal History */}
      <div className="settings-card m-0">
        <div className="card-header pb-md border-b border-border flex justify-between items-center">
          <h3 className="card-title text-base flex items-center gap-sm"><History size={18} /> Withdrawal History</h3>
          <button className="btn btn-outline btn-sm flex-center gap-xs"><FileText size={14} /> Download Tax Report</button>
        </div>
        <div className="card-body p-0">
          <table className="dashboard-table w-full">
            <thead>
              <tr>
                <th className="pl-xl">Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Method</th>
                <th className="text-right pr-xl">Invoice</th>
              </tr>
            </thead>
            <tbody>
                {loadingTransfers ? (
                  <tr>
                    <td colSpan="5" className="text-center py-2xl text-secondary">Loading transfers...</td>
                  </tr>
                ) : transfers.length > 0 ? transfers.map((wd) => (
                  <tr key={wd.id} className="hover:bg-bg-tertiary transition-colors cursor-pointer">
                    <td className="pl-xl text-sm font-medium">{new Date(wd.purchased_at).toLocaleDateString()}</td>
                    <td className="text-sm font-bold text-primary">{formatEur(wd.seller_amount_cents / 100)}</td>
                    <td>
                      <span className="badge badge-success text-xs px-sm py-[2px] rounded-full flex items-center gap-xs w-max">
                        <CheckCircle2 size={12} /> completed
                      </span>
                    </td>
                    <td className="text-sm text-secondary">Stripe Transfer</td>
                    <td className="text-right pr-xl">
                      <button className="text-accent hover:text-accent-hover transition-colors p-xs rounded-md hover:bg-accent-subtle">
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="text-center py-2xl text-secondary">
                      <History size={32} className="mx-auto mb-sm opacity-50" />
                      <p>No withdrawal history yet.</p>
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
