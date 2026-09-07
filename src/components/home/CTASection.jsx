import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './CTASection.css';

export default function CTASection() {
  const { t } = useTranslation();
  return (
    <section className="cta-section section">
      <div className="container relative cta-container">
        
        {/* Subtle glow behind the CTA */}
        <div className="cta-glow" />

        <motion.div 
          className="cta-card"
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="cta-content">
            <h2 className="cta-title">{t('hero.startSelling')}</h2>
            <p className="cta-subtitle">{t('sections.howItWorksDesc')}</p>
            
            <div className="cta-actions">
              <Link to="/login" className="btn btn-primary btn-hero">
                {t('hero.startSelling')}
              </Link>
              <Link to="/marketplace" className="btn btn-outline btn-hero-outline">
                {t('hero.browseMarketplace')}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
