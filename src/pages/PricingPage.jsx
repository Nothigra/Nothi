import { useTranslation } from 'react-i18next';
import { Check, Minus, X, Star, Shield, Zap } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import './PricingPage.css';

export default function PricingPage() {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();

  const featuresList = [
    { id: 'full_access', label: t('pricing.feat.access', 'Full access to the platform') },
    { id: 'products', label: t('pricing.feat.products', 'Products published') },
    { id: 'file_size', label: t('pricing.feat.filesize', 'Maximum file size') },
    { id: 'marketplace', label: t('pricing.feat.marketplace', 'Marketplace access') },
    { id: 'custom_shop', label: t('pricing.feat.custom_shop', 'Fully customizable shop') },
    { id: 'basic_analytics', label: t('pricing.feat.basic_analytics', 'Basic Analytics') },
    { id: 'adv_analytics', label: t('pricing.feat.adv_analytics', 'Advanced Analytics') },
    { id: 'ranking', label: t('pricing.feat.ranking', 'Better Featured Product ranking') },
    { id: 'badge', label: t('pricing.feat.badge', 'Creator Badge') }
  ];

  const plans = [
    {
      name: t('pricing.freeName', 'Free'),
      price: formatPrice(0),
      period: t('pricing.freePeriod', 'forever'),
      description: t('pricing.freeDesc', 'Launch your shop and start selling.'),
      buttonText: t('pricing.freeBtn', 'Get Started'),
      buttonClass: 'btn-outline',
      popular: false,
      included: ['full_access', 'custom_shop', 'basic_analytics'],
      notIncluded: ['adv_analytics', 'ranking', 'badge'],
      customValues: {
        'products': '30 Products',
        'file_size': '300 MB'
      }
    },
    {
      name: t('pricing.creatorName', 'Creator'),
      price: formatPrice(12),
      period: t('pricing.creatorPeriod', 'per month'),
      description: t('pricing.creatorDesc', 'Unlock advanced tools to grow your audience and sales.'),
      buttonText: t('pricing.creatorBtn', 'Upgrade to Creator'),
      buttonClass: 'btn-primary',
      popular: true,
      included: ['full_access', 'custom_shop', 'adv_analytics', 'ranking', 'badge'],
      notIncluded: [],
      customValues: {
        'products': 'Unlimited',
        'file_size': '500 MB'
      }
    },
    {
      name: t('pricing.creatorAnnualName', 'Creator Annual'),
      price: formatPrice(99),
      period: t('pricing.creatorAnnualPeriod', 'per year'),
      tagline: t('pricing.creatorAnnualTagline', 'Only $8.25/month'),
      saveBadge: t('pricing.creatorAnnualBadge', 'Save 31%'),
      description: t('pricing.creatorAnnualDesc', 'All Creator features, billed annually for the best value.'),
      buttonText: t('pricing.creatorAnnualBtn', 'Save with Annual'),
      buttonClass: 'btn-outline',
      popular: false,
      included: ['full_access', 'custom_shop', 'adv_analytics', 'ranking', 'badge'],
      notIncluded: [],
      customValues: {
        'products': 'Unlimited',
        'file_size': '500 MB'
      }
    }
  ];

  return (
    <div className="pricing-page-container">
      <div className="pricing-header">
        <h1 className="page-title">{t('pricing.title', 'Pricing')}</h1>
        <p className="page-subtitle text-muted mx-auto">
          {t('pricing.subtitle', 'Simple, transparent pricing for creators of all sizes. Start for free and upgrade when you need more power.')}
        </p>
      </div>

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
                  <h4 className="feature-group-title">Included</h4>
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
                        <span><strong>{value}</strong> {feature.label.replace('Products published', 'products')}</span>
                      </div>
                    );
                  })}
                </div>

                {plan.notIncluded.length > 0 && (
                  <div className="feature-group mt-md pt-md" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <h4 className="feature-group-title text-tertiary">Not Included</h4>
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
                <button className={`btn btn-lg w-full ${plan.buttonClass}`}>
                  {plan.buttonText}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pricing-trust-section">
        <h3 className="trust-title">Why creators choose Nothi</h3>
        <div className="trust-features">
          <div className="trust-item">
            <div className="trust-dot"></div>
            <span>Upgrade or cancel anytime.</span>
          </div>
          <div className="trust-item">
            <div className="trust-dot"></div>
            <span>Keep full access to your products.</span>
          </div>
          <div className="trust-item">
            <div className="trust-dot"></div>
            <span>No hidden fees.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
