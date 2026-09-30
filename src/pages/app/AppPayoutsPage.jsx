import { ArrowRight, BadgeCheck, Banknote, CheckCircle2, Clock, ExternalLink, Landmark, Loader2, ShieldCheck, ShoppingBag, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePayouts } from '../../hooks/usePayouts';
import { isMockMode } from '../../lib/supabase';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { tap } from '../../lib/native';
import './AppPages.css';
import './AppMoney.css';
import './AppPublish.css';

/** Earnings & payouts, app version: what you earned, what's on its way, one button to get paid. */
export default function AppPayoutsPage() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const {
    earnings, formatEur, handleConnectStripe, handleManageStripe, handleRequestPayout, isDetailsSubmitted,
    isFullyConnected, isManagingStripe, isPendingVerify, isSettling, loadingTransfers, pendingBalanceCents,
    profile, stripeConnecting, stripeMessage, stripeStatusLoading, transfers,
  } = usePayouts();

  const pending = pendingBalanceCents == null ? null : pendingBalanceCents / 100;
  const net = isMockMode ? pending : earnings ? earnings.netCents / 100 : null;
  const sent = earnings ? earnings.transferredCents / 100 : 0;
  const hasAccount = !!profile?.stripe_account_id;

  return (
    <div className="app-page money-page">
      <section className="money-hero">
        <span className="money-label">Ready to transfer</span>
        <span className="money-amount">{pending == null ? '—' : formatEur(pending)}</span>
        <div className="money-split">
          <div><small>Total earned</small><b>{net == null ? '—' : formatEur(net)}</b></div>
          <div><small>Already paid out</small><b>{formatEur(sent)}</b></div>
        </div>
      </section>

      {stripeMessage && (
        <div className={`money-note ${stripeMessage.type}`} role="status">
          {stripeMessage.type === 'error' ? <AlertCircle size={18} /> : stripeMessage.type === 'warning' ? <Info size={18} /> : <CheckCircle2 size={18} />}
          <span>{stripeMessage.text}</span>
        </div>
      )}

      {/* payout method */}
      {!hasAccount ? (
        <section className="money-card">
          <span className="money-card-icon"><Landmark size={22} /></span>
          <h3>Connect your bank</h3>
          <p>Nothi pays you through Stripe, the payment service used by millions of businesses. It takes about 5 minutes: your identity and your bank account (IBAN).</p>
          <button type="button" className="pub-btn primary wide money-btn" disabled={stripeConnecting} onClick={() => { tap('MEDIUM'); handleConnectStripe(); }}>
            {stripeConnecting ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />} Set up payouts
          </button>
        </section>
      ) : stripeStatusLoading && !isFullyConnected && !isPendingVerify ? (
        <section className="money-card row"><Loader2 size={20} className="spin" /> Checking your Stripe account…</section>
      ) : isFullyConnected ? (
        <section className="money-card">
          <div className="money-status ok"><BadgeCheck size={18} /> Payouts active</div>
          <p>New sales are sent to your Stripe account automatically. Stripe then pays your bank on its usual schedule.</p>
          <button type="button" className="pub-btn primary wide money-btn" disabled={isSettling || !pending} onClick={() => { tap('MEDIUM'); handleRequestPayout(); }}>
            {isSettling ? <><Loader2 size={18} className="spin" /> Transferring…</> : pending ? <>Transfer {formatEur(pending)} now <ArrowRight size={18} /></> : 'Nothing to transfer'}
          </button>
          <button type="button" className="pub-btn wide money-btn" disabled={isManagingStripe} onClick={() => { tap(); handleManageStripe(); }}>
            {isManagingStripe ? <Loader2 size={18} className="spin" /> : <ExternalLink size={17} />} Bank details & payout schedule
          </button>
        </section>
      ) : (
        <section className="money-card">
          <div className="money-status wait"><Clock size={18} /> {isDetailsSubmitted ? 'Stripe is verifying your account' : 'Setup not finished'}</div>
          <p>{isDetailsSubmitted
            ? 'This usually takes a few minutes, sometimes up to a day. Your earnings are safe and will be transferred as soon as it’s done.'
            : 'Finish the Stripe form to start receiving your money.'}</p>
          <button type="button" className="pub-btn primary wide money-btn" disabled={stripeConnecting || isManagingStripe}
            onClick={() => { tap('MEDIUM'); if (isDetailsSubmitted) handleManageStripe(); else handleConnectStripe(); }}>
            {isDetailsSubmitted ? 'Open Stripe' : 'Continue setup'} <ArrowRight size={18} />
          </button>
          {isDetailsSubmitted && (
            <button type="button" className="pub-btn wide money-btn" disabled={isSettling || !pending} onClick={() => { tap(); handleRequestPayout(); }}>
              {isSettling ? <Loader2 size={18} className="spin" /> : null} Check again & transfer
            </button>
          )}
        </section>
      )}

      {/* how it works */}
      <section className="app-group">
        <h3 className="app-group-title">How you get paid</h3>
        <ol className="money-steps">
          <li><span><ShoppingBag size={16} /></span><div><b>Someone buys your product</b><small>You keep the price minus 5% and payment fees.</small></div></li>
          <li><span><Banknote size={16} /></span><div><b>Nothi sends it to your Stripe account</b><small>Automatically, once your account is verified.</small></div></li>
          <li><span><Landmark size={16} /></span><div><b>Stripe pays your bank</b><small>Usually within a few days of the sale.</small></div></li>
        </ol>
      </section>

      {/* history */}
      <section className="app-group">
        <h3 className="app-group-title">Transfers</h3>
        {loadingTransfers ? (
          <div className="app-list-skeleton"><div className="app-skel-row" /><div className="app-skel-row" /></div>
        ) : transfers.length === 0 ? (
          <div className="app-quiet">No transfers yet.</div>
        ) : (
          <div className="app-group-card">
            {transfers.map((t) => (
              <div key={t.id} className="app-sale-row">
                <span className="app-sale-avatar"><Banknote size={18} /></span>
                <span className="app-result-meta">
                  <span className="app-result-title">{getLocalizedString(t.product?.title, lang) || 'Sale'}</span>
                  <span className="app-result-sub">{new Date(t.purchased_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </span>
                <span className="app-sale-amount">+{formatEur((t.seller_amount_cents || 0) / 100)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      {isMockMode && <p className="app-version">Demo mode — no real money moves.</p>}
    </div>
  );
}
