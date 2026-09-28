import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PLAN_LIMITS, PRO_PRICING, isPro, formatFileSize } from '../config/plans';
import { startProCheckout, openBillingPortal, billingErrorMessage } from '../api/billingApi';
import './PricingPage.css';

// Pro is billed in EUR by Stripe — show the real charged currency, not a
// converted estimate, so the price on this page is exactly what's charged.
const formatEur = (amount, lang) =>
  new Intl.NumberFormat(lang || 'fr-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);

export default function PricingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, profile } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);
  const userIsPro = isPro(profile);
  const lang = i18n.language || 'fr-BE';

  const featuresList = [
    { id: 'full_access', label: t('billing.feat.access', 'Full access to the platform') },
    { id: 'products', label: t('billing.feat.products', 'products') },
    { id: 'file_size', label: t('billing.feat.filesize', 'per file') },
    { id: 'custom_shop', label: t('billing.feat.custom_shop', 'Fully customizable shop') },
    { id: 'basic_analytics', label: t('billing.feat.basic_analytics', 'Basic Analytics') },
    { id: 'adv_analytics', label: t('billing.feat.adv_analytics', 'Advanced Analytics (conversion, best hours, boost impact)') },
    { id: 'boosts', label: t('billing.feat.boosts', 'Monthly boosts: 3 × 24h, 2 × 3 days or 1 × 7 days') },
    { id: 'badge', label: t('billing.feat.badge', 'Verified Pro badge on your profile') },
  ];

  const proIncluded = ['full_access', 'custom_shop', 'basic_analytics', 'adv_analytics', 'boosts', 'badge'];
  const proValues = {
    products: t('billing.unlimited', 'Unlimited'),
    file_size: formatFileSize(PLAN_LIMITS.pro.maxFileSizeMB),
  };

  const handleSelect = async (planKey) => {
    setError(null);
    if (planKey === 'free') {
      navigate(isAuthenticated ? '/dashboard' : '/login');
      return;
    }
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setLoadingPlan(planKey);
    try {
      if (userIsPro) {
        await openBillingPortal();
      } else {
        await startProCheckout(planKey === 'pro_year' ? 'year' : 'month');
      }
    } catch (err) {
      setError(billingErrorMessage(err));
      setLoadingPlan(null);
    }
  };

  const proButtonText = (defaultText) =>
    userIsPro ? t('billing.manageBtn', 'Manage subscription') : defaultText;

  const plans = [
    {
      key: 'free',
      name: t('billing.freeName', 'Free'),
      price: formatEur(0, lang),
      period: t('billing.freePeriod', 'forever'),
      description: t('billing.freeDesc', 'Launch your shop and start selling.'),
      buttonText: isAuthenticated
        ? (userIsPro ? t('billing.goDashboard', 'Go to dashboard') : t('billing.currentPlan', 'Your current plan'))
        : t('billing.freeBtn', 'Get Started'),
      buttonClass: 'btn-outline',
      popular: false,
      included: ['full_access', 'custom_shop', 'basic_analytics'],
      notIncluded: ['adv_analytics', 'boosts', 'badge'],
      customValues: {
        products: String(PLAN_LIMITS.free.maxProducts),
        file_size: formatFileSize(PLAN_LIMITS.free.maxFileSizeMB),
      },
    },
    {
      key: 'pro_month',
      name: t('billing.proName', 'Pro'),
      price: formatEur(PRO_PRICING.month.amount, lang),
      period: t('billing.proPeriod', 'per month'),
      description: t('billing.proDesc', 'Unlock everything to grow your audience and sales.'),
      buttonText: proButtonText(t('billing.proBtn', 'Upgrade to Pro')),
      buttonClass: 'btn-primary',
      popular: true,
      included: proIncluded,
      notIncluded: [],
      customValues: proValues,
    },
    {
      key: 'pro_year',
      name: t('billing.proAnnualName', 'Pro Annual'),
      price: formatEur(PRO_PRICING.year.amount, lang),
      period: t('billing.proAnnualPeriod', 'per year'),
      tagline: t('billing.proAnnualTagline', 'Only {{price}}/month', { price: formatEur(PRO_PRICING.year.monthlyEquivalent, lang) }),
      saveBadge: t('billing.proAnnualBadge', 'Save {{pct}}%', { pct: PRO_PRICING.year.savingsPercent }),
      description: t('billing.proAnnualDesc', 'All Pro features, billed yearly for the best value.'),
      buttonText: proButtonText(t('billing.proAnnualBtn', 'Save with Annual')),
      buttonClass: 'btn-outline',
      popular: false,
      included: proIncluded,
      notIncluded: [],
      customValues: proValues,
    },
  ];

  return (
    <div className="pricing-page-container">
      <div className="pricing-header">
        <h1 className="page-title">{t('pricing.title', 'Pricing')}</h1>
        <p className="page-subtitle text-muted mx-auto">
          {t('pricing.subtitle', 'Simple, transparent pricing for creators of all sizes. Start for free and upgrade when you need more power.')}
        </p>
      </div>

      {searchParams.get('checkout') === 'cancelled' && (
        <div className="pricing-notice">{t('billing.checkoutCancelled', 'Checkout cancelled — you have not been charged.')}</div>
      )}
      {error && <div className="pricing-notice pricing-notice-error" role="alert">{error}</div>}

      <div className="pricing-grid">
        {plans.map((plan, index) => (
          <div key={index} className="pricing-card-wrapper">
            <div className="flex justify-between items-end mb-xs" style={{ minHeight: '20px' }}>
              {plan.popular ? <div className="popular-badge">{t('pricing.mostPopular', 'MOST POPULAR')}</div> : <div></div>}
              {plan.saveBadge && <div className="save-badge">{plan.saveBadge}</div>}
            </div>
            
            <div className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
              <div className="pricing-card-header">
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-desc">{plan.description}</p>
                <div className="plan-price-wrapper">
                  <span className="plan-price">{plan.price}</span>
                  <span className="plan-period">/{plan.period}</span>
                </div>
                {plan.tagline && <div className="plan-tagline font-medium text-accent">{plan.tagline}</div>}
              </div>

              <div className="plan-features">
                <div className="feature-group">
                  <h4 className="feature-group-title">{t('billing.included', 'Included')}</h4>
                  {plan.included.map((featId) => {
                    const feature = featuresList.find(f => f.id === featId);
                    return (
                      <div key={featId} className="feature-item advantage">
                        <Check size={16} className="feature-check" />
                        <span>{feature.label}</span>
                      </div>
                    );
                  })}
                  {Object.entries(plan.customValues).map(([featId, value]) => {
                    const feature = featuresList.find(f => f.id === featId);
                    return (
                      <div key={featId} className="feature-item advantage">
                        <Check size={16} className="feature-check" />
                        <span><strong>{value}</strong> {feature.label}</span>
                      </div>
                    );
                  })}
                </div>

                {plan.notIncluded.length > 0 && (
                  <div className="feature-group mt-md pt-md" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <h4 className="feature-group-title text-tertiary">{t('billing.notIncluded', 'Not included')}</h4>
                    {plan.notIncluded.map((featId) => {
                      const feature = featuresList.find(f => f.id === featId);
                      return (
                        <div key={featId} className="feature-item limitation">
                          <X size={16} className="feature-limitation-icon" />
                          <span>{feature.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pricing-card-footer">
                <button
                  className={`btn btn-lg w-full ${plan.buttonClass}`}
                  onClick={() => handleSelect(plan.key)}
                  disabled={loadingPlan !== null || (plan.key === 'free' && isAuthenticated && !userIsPro)}
                >
                  {loadingPlan === plan.key ? t('billing.redirecting', 'Redirecting to secure payment…') : plan.buttonText}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pricing-trust-section">
        <h3 className="trust-title">{t('billing.trustTitle', 'Why creators choose Nothi')}</h3>
        <div className="trust-features">
          <div className="trust-item">
            <div className="trust-dot"></div>
            <span>{t('billing.trust1', 'Upgrade or cancel anytime. Secure payment by Stripe.')}</span>
          </div>
          <div className="trust-item">
            <div className="trust-dot"></div>
            <span>{t('billing.trust2', 'Keep all your products if you cancel.')}</span>
          </div>
          <div className="trust-item">
            <div className="trust-dot"></div>
            <span>{t('billing.trust3', 'No hidden fees.')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
