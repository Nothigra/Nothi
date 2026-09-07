import { useTranslation } from 'react-i18next';
import { Store, Upload, DollarSign } from 'lucide-react';
import './HowItWorks.css';

export default function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    {
      id: 1,
      icon: Store,
      title: t('howItWorks.step1Title'),
      desc: t('howItWorks.step1Desc')
    },
    {
      id: 2,
      icon: Upload,
      title: t('howItWorks.step2Title'),
      desc: t('howItWorks.step2Desc')
    },
    {
      id: 3,
      icon: DollarSign,
      title: t('howItWorks.step3Title'),
      desc: t('howItWorks.step3Desc')
    }
  ];

  return (
    <section className="how-it-works">
      <div className="container">
        <div className="section-header step-content-center">
          <h2 className="section-title">{t('sections.howItWorks')}</h2>
          <p className="section-desc">{t('sections.howItWorksDesc')}</p>
        </div>

        <div className="steps-container">
          <div className="steps-line"></div>
          
          <div className="steps-grid">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="step-card glass-card">
                  <div className="step-number">{step.id}</div>
                  <div className="step-icon-wrapper">
                    <Icon size={32} className="step-icon" />
                  </div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc text-muted">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
