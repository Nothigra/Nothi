import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, Check, TrendingUp, Sparkles, Crown, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isMockMode } from '../../lib/supabase';
import { BOOST_OPTIONS, PRO_BOOST_PACKS, isPro } from '../../config/plans';
import {
  startBoostCheckout, activateProBoost, getBoostQuota, billingErrorMessage,
} from '../../api/billingApi';
import './BoostModal.css';
import { isNativeApp } from '../../lib/native';

const formatEur = (amount, lang) =>
  new Intl.NumberFormat(lang || 'fr-BE', { style: 'currency', currency: 'EUR' }).format(amount);

/**
 * Real mode:
 *   - Free sellers pay per boost through Stripe Checkout (applied by the webhook).
 *   - Pro sellers spend their monthly pack (RPC), and can still buy extra boosts.
 * Mock mode keeps the old local simulation via `onBoost`.
 */
export default function BoostModal({ isOpen, onClose, product, onBoost, onBoosted }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'fr-BE';
  const { profile } = useAuth();
  const userIsPro = isPro(profile);

  const [mode, setMode] = useState(userIsPro ? 'pro' : 'paid');
  const [selectedDays, setSelectedDays] = useState(3);
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || isMockMode || !userIsPro) return;
    let cancelled = false;
    setQuotaLoading(true);
    getBoostQuota()
      .then((q) => {
        if (cancelled) return;
        setQuota(q);
        // A pack is already chosen this month: preselect it.
        if (q?.pack_days) setSelectedDays(q.pack_days);
      })
      .catch((err) => !cancelled && setError(billingErrorMessage(err)))
      .finally(() => !cancelled && setQuotaLoading(false));
    return () => { cancelled = true; };
  }, [isOpen, userIsPro]);

  if (!isOpen || !product) return null;

  const title = typeof product.title === 'object'
    ? (product.title?.[lang.split('-')[0]] || product.title?.en || Object.values(product.title)[0])
    : product.title;

  const boostEnd = isMockMode
    ? (product.boost?.endDate ? new Date(product.boost.endDate) : null)
    : (product.boosted_until ? new Date(product.boosted_until) : null);
  const isBoosted = boostEnd && boostEnd > new Date();
  const isPublished = isMockMode || (product.status || 'published') === 'published';

  const lockedPack = quota?.pack_days ?? null;
  const proRemaining = lockedPack ? quota.remaining : null;
  const proExhausted = lockedPack !== null && proRemaining <= 0;
  const resetsAt = quota?.resets_at ? new Date(quota.resets_at) : null;

  const handleMockActivate = async () => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + selectedDays);
    onBoost?.(product.id, {
      active: true, type: 'marketplace', plan: `${selectedDays}d`,
      startDate: start.toISOString(), endDate: end.toISOString(), priority: 1,
    });
    setIsProcessing(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (isMockMode) return handleMockActivate();
    setError(null);
    setIsProcessing(true);
    try {
      if (mode === 'pro') {
        const result = await activateProBoost(product.id, selectedDays);
        onBoosted?.(product.id, result.boosted_until);
        onClose();
      } else {
        await startBoostCheckout(product.id, selectedDays); // redirects to Stripe
      }
    } catch (err) {
      setError(billingErrorMessage(err));
      setIsProcessing(false);
    }
  };

  const renderProPacks = () => (
    <div className="boost-plans">
      {quotaLoading && <p className="text-muted text-sm text-center">{t('billing.loading', 'Loading…')}</p>}
      {!quotaLoading && PRO_BOOST_PACKS.map((pack) => {
        const lockedOut = lockedPack !== null && lockedPack !== pack.days;
        const isSelected = selectedDays === pack.days && !lockedOut;
        const isCurrent = lockedPack === pack.days;
        return (
          <div
            key={pack.days}
            className={`boost-plan-card ${isSelected ? 'selected' : ''} ${lockedOut ? 'disabled' : ''}`}
            onClick={() => !lockedOut && setSelectedDays(pack.days)}
            aria-disabled={lockedOut}
          >
            <div className="plan-radio">
              <div className="radio-circle">{isSelected && <div className="radio-dot" />}</div>
            </div>
            <div className="plan-content">
              <div className="plan-title-row">
                <span className="plan-title">{pack.label}</span>
                <span className="plan-price">
                  {isCurrent
                    ? t('billing.packLeft', '{{n}} left', { n: proRemaining })
                    : lockedOut ? <Lock size={14} /> : t('billing.included', 'Included')}
                </span>
              </div>
              <p className="plan-desc">
                {lockedOut
                  ? t('billing.packLockedDesc', 'Available again next month')
                  : t('billing.packDesc', 'Each boost lasts {{d}}. Choosing this pack locks it for the month.', { d: pack.days === 1 ? '24h' : t('billing.nDays', '{{n}} days', { n: pack.days }) })}
              </p>
            </div>
          </div>
        );
      })}
      {proExhausted && resetsAt && (
        <p className="boost-quota-note">
          {t('billing.quotaExhausted', 'Monthly boosts used. They reset on {{date}}. You can still buy an extra boost.', { date: resetsAt.toLocaleDateString(lang) })}
        </p>
      )}
    </div>
  );

  const renderPaidOptions = () => (
    <div className="boost-plans">
      {BOOST_OPTIONS.map((opt) => {
        const isSelected = selectedDays === opt.days;
        return (
          <div
            key={opt.days}
            className={`boost-plan-card ${isSelected ? 'selected' : ''} ${opt.recommended ? 'recommended' : ''}`}
            onClick={() => setSelectedDays(opt.days)}
          >
            {opt.recommended && <div className="recommended-badge"><Sparkles size={12} /> {t('billing.bestValue', 'BEST VALUE')}</div>}
            <div className="plan-radio">
              <div className="radio-circle">{isSelected && <div className="radio-dot" />}</div>
            </div>
            <div className="plan-content">
              <div className="plan-title-row">
                <span className="plan-title">{opt.days === 1 ? '24h' : t('billing.nDays', '{{n}} days', { n: opt.days })}</span>
                <span className="plan-price">{formatEur(opt.price, lang)}</span>
              </div>
              {isSelected && (
                <motion.div className="plan-perks" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div className="perk"><TrendingUp size={14} /> {t('billing.perkVisibility', 'Higher ranking in the Marketplace')}</div>
                  <div className="perk"><Check size={14} /> {t('billing.perkFeatured', 'Boosted label on your product')}</div>
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
      {!userIsPro && !isMockMode && !isNativeApp && (
        <Link to="/pricing" className="boost-pro-upsell" onClick={onClose}>
          <Crown size={14} /> {t('billing.boostUpsell', 'Pro includes up to 3 boosts every month — see Pro')}
        </Link>
      )}
    </div>
  );

  // Store rules: in the app only Pro boosts (already paid) can be used.
  const appPaidBlocked = isNativeApp && !userIsPro && !isMockMode;
  const confirmDisabled = isProcessing || !isPublished ||
    (mode === 'pro' && !isMockMode && (quotaLoading || proExhausted || (lockedPack !== null && lockedPack !== selectedDays)));

  const selectedPaid = BOOST_OPTIONS.find((o) => o.days === selectedDays);
  const confirmLabel = isProcessing
    ? (mode === 'paid' && !isMockMode ? t('billing.redirecting', 'Redirecting to secure payment…') : t('billing.activating', 'Activating…'))
    : mode === 'pro' || isMockMode
      ? (isBoosted ? t('billing.extendWithPack', 'Extend with 1 Pro boost') : t('billing.useProBoost', 'Use 1 Pro boost'))
      : t('billing.payBoost', 'Pay {{price}}', { price: formatEur(selectedPaid?.price ?? 0, lang) });

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          className="boost-modal"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <button className="modal-close" onClick={onClose} aria-label={t('billing.close', 'Close')}>
            <X size={20} />
          </button>

          <div className="boost-modal-header">
            <div className="boost-icon-wrapper">
              <Rocket size={24} className="text-accent" />
            </div>
            <h2>{isBoosted ? t('billing.extendBoostTitle', 'Extend the boost') : t('billing.boostTitle', 'Boost product visibility')}</h2>
            <p className="text-muted">
              {isBoosted
                ? t('billing.boostActiveUntil', '"{{title}}" is boosted until {{date}}. A new boost adds time on top.', { title, date: boostEnd.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) })
                : t('billing.boostDesc', 'Temporarily push "{{title}}" higher in the Marketplace.', { title })}
            </p>
          </div>

          {userIsPro && !isMockMode && !isNativeApp && (
            <div className="boost-mode-tabs" role="tablist">
              <button role="tab" aria-selected={mode === 'pro'} className={mode === 'pro' ? 'active' : ''}
                onClick={() => { setMode('pro'); setError(null); if (lockedPack) setSelectedDays(lockedPack); }}>
                <Crown size={14} /> {t('billing.tabPro', 'Pro boosts')}
              </button>
              <button role="tab" aria-selected={mode === 'paid'} className={mode === 'paid' ? 'active' : ''}
                onClick={() => { setMode('paid'); setError(null); }}>
                {t('billing.tabBuy', 'Buy a boost')}
              </button>
            </div>
          )}

          {!isPublished && (
            <p className="boost-quota-note">{t('billing.publishFirst', 'Publish this product first to boost it.')}</p>
          )}

          {appPaidBlocked
            ? <p className="boost-quota-note">{t('billing.boostOnWebsite', 'Paid boosts are available on the Nothi website. Pro members can use their monthly boosts right here.')}</p>
            : (mode === 'pro' && !isMockMode ? renderProPacks() : renderPaidOptions())}

          {error && <p className="boost-error" role="alert">{error}</p>}

          <div className="boost-modal-footer">
            <p className="boost-disclaimer">
              {mode === 'paid' && !isMockMode && !appPaidBlocked
                ? t('billing.boostPaidDisclaimer', 'One-time payment by Stripe. The boost starts as soon as payment is confirmed.')
                : t('billing.boostDisclaimer', 'Boosted products rank higher in Marketplace listings during the selected period.')}
            </p>
            <div className="footer-actions">
              <button className="btn btn-outline" onClick={onClose} disabled={isProcessing}>{t('billing.cancel', 'Cancel')}</button>
              {!appPaidBlocked && (
                <button className="btn btn-primary flex-center gap-sm" onClick={handleConfirm} disabled={confirmDisabled}>
                  {confirmLabel} <Rocket size={16} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
