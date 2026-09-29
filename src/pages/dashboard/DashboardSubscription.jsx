import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Crown, Rocket, BarChart3, Package, HardDrive, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isMockMode, supabase, withTimeoutSafety } from '../../lib/supabase';
import { PLAN_LIMITS, PRO_PRICING, PRO_BOOST_PACKS, isPro, formatFileSize } from '../../config/plans';
import {
  startProCheckout, openBillingPortal, getBoostQuota, billingErrorMessage,
} from '../../api/billingApi';
import Toggle from '../../components/ui/Toggle';
import ProBadge from '../../components/common/ProBadge';
import './DashboardPages.css';
import './DashboardSubscription.css';
import { isNativeApp } from '../../lib/native';

const formatEur = (amount, lang) =>
  new Intl.NumberFormat(lang || 'fr-BE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);

export default function DashboardSubscription() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'fr-BE';
  const { profile, updateProfile, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [busy, setBusy] = useState(null); // 'month' | 'year' | 'portal'
  const [error, setError] = useState(null);
  const [activating, setActivating] = useState(false);
  const [justActivated, setJustActivated] = useState(false);
  const [quota, setQuota] = useState(null);
  const [productCount, setProductCount] = useState(null);
  const [badgeSaving, setBadgeSaving] = useState(false);
  const pollRef = useRef(null);

  const userIsPro = isPro(profile);
  const status = profile?.subscription_status;
  const periodEnd = profile?.subscription_current_period_end ? new Date(profile.subscription_current_period_end) : null;
  const cancelling = !!profile?.subscription_cancel_at_period_end;
  const interval = profile?.subscription_interval;

  // ── Back from Stripe: wait for the webhook to flip the plan ────────────────
  useEffect(() => {
    if (searchParams.get('checkout') !== 'success' || isMockMode) return;
    searchParams.delete('checkout');
    setSearchParams(searchParams, { replace: true });

    if (userIsPro) { setJustActivated(true); return; }
    setActivating(true);
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const fresh = await refreshProfile();
      if (fresh?.plan === 'pro') {
        setActivating(false);
        setJustActivated(true);
        return;
      }
      if (attempts < 15) pollRef.current = setTimeout(tick, 2000);
      else setActivating(false);
    };
    pollRef.current = setTimeout(tick, 1500);
    return () => clearTimeout(pollRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Boost quota + product usage ────────────────────────────────────────────
  useEffect(() => {
    if (isMockMode || !profile?.id) return;
    let cancelled = false;
    if (userIsPro) {
      getBoostQuota().then((q) => !cancelled && setQuota(q)).catch(() => {});
    }
    withTimeoutSafety(() =>
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', profile.id)
    ).then(({ count }) => !cancelled && setProductCount(count ?? 0)).catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.id, userIsPro]);

  const handleUpgrade = async (which) => {
    setError(null);
    setBusy(which);
    try {
      await startProCheckout(which);
    } catch (err) {
      setError(billingErrorMessage(err));
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setError(null);
    setBusy('portal');
    try {
      await openBillingPortal();
    } catch (err) {
      setError(billingErrorMessage(err));
      setBusy(null);
    }
  };

  const handleBadgeToggle = async (e) => {
    const next = e.target.checked;
    setBadgeSaving(true);
    const res = await updateProfile({ show_pro_badge: next });
    if (!res?.success) setError(t('billing.badgeSaveError', 'Could not save your badge preference.'));
    setBadgeSaving(false);
  };

  const limits = userIsPro ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
  const packLabel = quota?.pack_days ? PRO_BOOST_PACKS.find((p) => p.days === quota.pack_days)?.label : null;

  return (
    <div className="dashboard-page pb-3xl sub-page">
      <div className="dashboard-page-header mb-xl">
        <div>
          <h1 className="dashboard-title flex items-center gap-sm">
            <Crown size={26} className="text-accent" /> Nothi Pro
          </h1>
          <p className="dashboard-subtitle">
            {t('billing.subPageSubtitle', 'Your plan, billing and Pro benefits.')}
          </p>
        </div>
      </div>

      {activating && (
        <div className="sub-banner" role="status">
          <Loader2 size={18} className="spin" />
          {t('billing.activatingPro', 'Payment received — activating your Pro membership…')}
        </div>
      )}
      {justActivated && (
        <div className="sub-banner sub-banner-success" role="status">
          <CheckCircle2 size={18} />
          {t('billing.welcomePro', 'Welcome to Nothi Pro! All your benefits are now active.')}
        </div>
      )}
      {userIsPro && status === 'past_due' && (
        <div className="sub-banner sub-banner-warning" role="alert">
          <AlertTriangle size={18} />
          <span>
            {t('billing.pastDue', "Your last payment failed. Update your card to keep Pro.")}{' '}
            <button className="sub-link" onClick={handlePortal}>{t('billing.updateCard', 'Update card')}</button>
          </span>
        </div>
      )}
      {error && <div className="sub-banner sub-banner-error" role="alert">{error}</div>}

      {/* ── Current plan ─────────────────────────────────────────────────── */}
      <div className="settings-card">
        <div className="sub-plan-row">
          <div>
            <div className="sub-plan-label">{t('billing.currentPlanLabel', 'Current plan')}</div>
            <div className="sub-plan-name">
              {userIsPro ? 'Pro' : t('billing.freeName', 'Free')}
              {userIsPro && interval && (
                <span className="status-badge status-success">
                  {interval === 'year' ? t('billing.yearly', 'Yearly') : t('billing.monthly', 'Monthly')}
                </span>
              )}
            </div>
            {userIsPro && periodEnd && (
              <div className="sub-plan-meta">
                {cancelling
                  ? t('billing.endsOn', 'Pro ends on {{date}} — you can resume it anytime before.', { date: periodEnd.toLocaleDateString(lang) })
                  : t('billing.renewsOn', 'Renews on {{date}}', { date: periodEnd.toLocaleDateString(lang) })}
              </div>
            )}
          </div>

          <div className="sub-plan-actions">
            {isNativeApp ? (
              // Store rules: no subscription purchase or management links in the app.
              <p className="sub-app-note">{userIsPro
                ? 'Your Pro plan is managed on the Nothi website.'
                : 'Nothi Pro is available on the Nothi website. Your plan syncs to the app automatically.'}</p>
            ) : userIsPro ? (
              <button className="btn btn-outline" onClick={handlePortal} disabled={busy !== null}>
                {busy === 'portal' ? t('billing.opening', 'Opening…') : t('billing.manageBtn', 'Manage subscription')}
              </button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => handleUpgrade('month')} disabled={busy !== null || isMockMode}>
                  {busy === 'month'
                    ? t('billing.redirecting', 'Redirecting to secure payment…')
                    : t('billing.upgradeMonthly', 'Go Pro — {{price}}/month', { price: formatEur(PRO_PRICING.month.amount, lang) })}
                </button>
                <button className="btn btn-outline" onClick={() => handleUpgrade('year')} disabled={busy !== null || isMockMode}>
                  {busy === 'year'
                    ? t('billing.redirecting', 'Redirecting to secure payment…')
                    : t('billing.upgradeYearly', '{{price}}/year (save {{pct}}%)', { price: formatEur(PRO_PRICING.year.amount, lang), pct: PRO_PRICING.year.savingsPercent })}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Usage */}
        <div className="sub-usage-grid">
          <div className="sub-usage">
            <Package size={18} />
            <div>
              <div className="sub-usage-value">
                {productCount ?? '—'}{limits.maxProducts !== Infinity ? ` / ${limits.maxProducts}` : ''}
              </div>
              <div className="sub-usage-label">
                {limits.maxProducts === Infinity ? t('billing.productsUnlimited', 'products (unlimited)') : t('billing.productsLabel', 'products')}
              </div>
            </div>
          </div>
          <div className="sub-usage">
            <HardDrive size={18} />
            <div>
              <div className="sub-usage-value">{formatFileSize(limits.maxFileSizeMB)}</div>
              <div className="sub-usage-label">{t('billing.perFile', 'max per file')}</div>
            </div>
          </div>
          <div className="sub-usage">
            <BarChart3 size={18} />
            <div>
              <div className="sub-usage-value">{userIsPro ? t('billing.advanced', 'Advanced') : t('billing.basic', 'Basic')}</div>
              <div className="sub-usage-label">
                <Link to="/dashboard/analytics">{t('billing.analytics', 'analytics')}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Monthly boosts ───────────────────────────────────────────────── */}
      <div className="settings-card">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-sm"><Rocket size={18} /> {t('billing.monthlyBoosts', 'Monthly boosts')}</h3>
        </div>
        <div className="card-body">
          {!userIsPro ? (
            <p className="text-secondary">
              {t('billing.boostsFreeDesc', 'Pro members get a free boost pack every month: 3 × 24h, 2 × 3 days or 1 × 7 days. On the Free plan, boosts are paid per use.')}
            </p>
          ) : !quota ? (
            <p className="text-secondary">{t('billing.loading', 'Loading…')}</p>
          ) : quota.pack_days ? (
            <p>
              <strong>{packLabel}</strong>{' — '}
              {t('billing.packRemaining', '{{remaining}} of {{allowance}} left this month. Resets on {{date}}.', {
                remaining: quota.remaining, allowance: quota.allowance,
                date: new Date(quota.resets_at).toLocaleDateString(lang),
              })}
            </p>
          ) : (
            <p className="text-secondary">
              {t('billing.packNotChosen', 'No pack chosen yet this month. Pick 3 × 24h, 2 × 3 days or 1 × 7 days the first time you boost a product.')}
            </p>
          )}
          <Link to="/dashboard/products" className="btn btn-outline mt-md">{t('billing.boostAProduct', 'Boost a product')}</Link>
        </div>
      </div>

      {/* ── Pro badge ────────────────────────────────────────────────────── */}
      <div className="settings-card">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-sm">
            <ProBadge size={18} /> {t('billing.badgeTitle', 'Pro badge')}
          </h3>
        </div>
        <div className="card-body sub-badge-row">
          <p className="text-secondary">
            {userIsPro
              ? t('billing.badgeDesc', 'Show the verified Pro badge on your profile photo, products and messages.')
              : t('billing.badgeFreeDesc', 'Pro members get a verified badge on their profile photo. Upgrade to unlock it.')}
          </p>
          <Toggle
            checked={userIsPro && profile?.show_pro_badge !== false}
            onChange={handleBadgeToggle}
            disabled={!userIsPro || badgeSaving || isMockMode}
            aria-label={t('billing.badgeToggle', 'Show Pro badge')}
          />
        </div>
      </div>
    </div>
  );
}
