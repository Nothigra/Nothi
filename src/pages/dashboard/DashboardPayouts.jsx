import { 
  DollarSign, ArrowUpRight, Clock, CheckCircle2, AlertCircle, 
  Landmark, Wallet, History, FileText, ExternalLink,
  AlertTriangle, Download, Info
} from 'lucide-react';
import { isMockMode } from '../../lib/supabase';
import CurrencyInput from '../../components/ui/CurrencyInput';
import './DashboardPages.css';
import { usePayouts } from '../../hooks/usePayouts';
import { PLATFORM_FEE_PCT, PAYMENT_FEES, PAYOUT_FEES, payoutFeeCents } from '../../config/plans';
import SocialIcon from '../../components/common/SocialIcon';

export default function DashboardPayouts() {
  const { payoutMethod, paypalEmail, setPaypalEmail, savePayoutSettings, isSavingPayout, balance, earnings, formatEur, handleConnectStripe, handleManageStripe, handleMax, handleRequestPayout, handleWithdraw, isDetailsSubmitted, isFullyConnected, isManagingStripe, isPendingVerify, isProcessing, isSettling, loadingTransfers, message, pendingBalanceCents, profile, stripeConnecting, stripeMessage, stripeStatusLoading, transfers, withdrawAmount, setWithdrawAmount } = usePayouts();

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
          <h3 className="text-3xl font-bold font-display text-primary">{formatEur(balance)}</h3>
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
            {payoutMethod === 'paypal'
              ? (profile?.paypal_email ? <><CheckCircle2 size={14} className="text-success" /> Paid to your PayPal</> : <><Clock size={14} /> Add your PayPal email</>)
              : isFullyConnected
                ? <><CheckCircle2 size={14} className="text-success" /> Ready to transfer</>
                : <><Clock size={14} /> Connect Stripe to receive</>}
          </p>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Total Transferred</p>
          <h3 className="text-3xl font-bold font-display text-primary">
            {earnings === null ? '…' : formatEur(earnings.transferredCents / 100)}
          </h3>
          <p className="text-sm text-secondary mt-sm flex items-center gap-xs"><CheckCircle2 size={14} className="text-success" /> Sent to Stripe or PayPal</p>
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
                <span className="text-accent font-medium">Remaining: {formatEur(Math.max(0, balance - (parseFloat(withdrawAmount) || 0)))}</span>
              </div>
            </div>

            <div className="pt-lg border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
              <div className="mb-sm sm:mb-0">
                <p className="text-sm font-medium">Estimated Arrival</p>
                <p className="text-xs text-secondary">{new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(document.documentElement.lang || 'en')} - {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(document.documentElement.lang || 'en')}</p>
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
                  <span className="text-secondary">Nothi commission ({PLATFORM_FEE_PCT}%) + payment fees</span>
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

            {/* Every fee, written out */}
            <div className="fees-box mt-xl">
              <div className="fees-box-title"><Info size={15} /> What it costs</div>
              <div className="fees-row"><span>Nothi commission</span><span>{PLATFORM_FEE_PCT}% of each sale</span></div>
              <div className="fees-row"><span>Buyer pays by card</span><span>{PAYMENT_FEES.card.text}</span></div>
              <div className="fees-row"><span>Buyer pays with PayPal</span><span>{PAYMENT_FEES.paypal.text}</span></div>
              <div className="fees-sep" />
              <div className="fees-row"><span>Payout with Stripe</span><span>{PAYOUT_FEES.stripe.text}</span></div>
              <div className="fees-row"><span>Payout with PayPal</span><span>{PAYOUT_FEES.paypal.text}</span></div>
              <p className="fees-note">
                Sales are paid out 7 days after the purchase (refund window). All amounts are in euros (EUR).
              </p>
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
            {!isMockMode && (
              <div className="payout-switch" role="radiogroup" aria-label="Payout method">
                {['stripe', 'paypal'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={payoutMethod === m}
                    className={`payout-switch-opt ${payoutMethod === m ? 'active' : ''}`}
                    onClick={() => payoutMethod !== m && savePayoutSettings({ method: m })}
                    disabled={isSavingPayout}
                  >
                    <span className="payout-switch-icon">{m === 'stripe' ? <Landmark size={16} /> : <PaypalMark />}</span>
                    <span className="payout-switch-text">
                      <strong>{m === 'stripe' ? 'Bank (Stripe)' : 'PayPal'}</strong>
                      <small>{m === 'stripe' ? 'No fee for you' : `${PAYOUT_FEES.paypal.pct}% PayPal fee`}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}


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

            {!isMockMode && payoutMethod === 'paypal' ? (
              /* ── PayPal payouts ── */
              <PaypalPanel
                email={paypalEmail}
                setEmail={setPaypalEmail}
                savedEmail={profile?.paypal_email || ''}
                onSave={() => savePayoutSettings({ email: paypalEmail })}
                saving={isSavingPayout}
                pendingCents={pendingBalanceCents}
                onRequest={handleRequestPayout}
                settling={isSettling}
                formatEur={formatEur}
              />
            ) : isFullyConnected ? (
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
                  Keep your identity and tax details up to date in your Stripe account so payouts are never paused.
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
                    <td className="pl-xl text-sm font-medium">{new Date(wd.date).toLocaleDateString(document.documentElement.lang || 'en')}</td>
                    <td className="text-sm font-bold text-primary">
                      {formatEur(wd.cents / 100)}
                      {wd.feeCents > 0 && <span className="text-xs text-secondary font-normal"> (fee {formatEur(wd.feeCents / 100)})</span>}
                    </td>
                    <td>
                      <span className="badge badge-success text-xs px-sm py-[2px] rounded-full flex items-center gap-xs w-max">
                        <CheckCircle2 size={12} /> {wd.status}
                      </span>
                    </td>
                    <td className="text-sm text-secondary">{wd.method}</td>
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

function PaypalMark() {
  return <SocialIcon platform="paypal" size={16} />;
}

function PaypalPanel({ email, setEmail, savedEmail, onSave, saving, pendingCents, onRequest, settling, formatEur }) {
  const dirty = (email || '').trim().toLowerCase() !== (savedEmail || '').toLowerCase();
  const fee = payoutFeeCents('paypal', pendingCents || 0);
  return (
    <div className="flex flex-col gap-md">
      <label className="text-sm font-medium" htmlFor="paypal-email">PayPal email</label>
      <div className="flex gap-sm">
        <input
          id="paypal-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="payout-input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="button" className="btn btn-outline" onClick={onSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="text-xs text-secondary">Payouts go to the PayPal account that uses this email. {PAYOUT_FEES.paypal.delay}.</p>

      {pendingCents > 0 && savedEmail && (
        <>
          <div className="payout-preview">
            <div><span>Available</span><span>{formatEur(pendingCents / 100)}</span></div>
            <div><span>PayPal fee ({PAYOUT_FEES.paypal.pct}%)</span><span>-{formatEur(fee / 100)}</span></div>
            <div className="payout-preview-total"><span>You receive</span><span>{formatEur((pendingCents - fee) / 100)}</span></div>
          </div>
          <button className="btn btn-primary w-full flex-center gap-sm" onClick={onRequest} disabled={settling}>
            {settling
              ? <><div className="loader spin" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Sending…</>
              : <><ArrowUpRight size={14} /> Send {formatEur((pendingCents - fee) / 100)} to PayPal</>}
          </button>
        </>
      )}
    </div>
  );
}
