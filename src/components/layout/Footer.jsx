import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SOCIAL_LINKS } from '../../config/links';
import './Footer.css';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              Nothi
            </Link>
            <p className="footer-desc text-muted">
              {t('footer.description')}
            </p>
            {Object.values(SOCIAL_LINKS).some(Boolean) && (
              <div className="social-links">
                {SOCIAL_LINKS.twitter && <a href={SOCIAL_LINKS.twitter} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg></a>}
                {SOCIAL_LINKS.instagram && <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>}
                {SOCIAL_LINKS.youtube && <a href={SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg></a>}
              </div>
            )}
          </div>

          <div className="footer-column">
            <h4 className="footer-heading">{t('footer.product')}</h4>
            <ul className="footer-links">
              <li><Link to="/marketplace">{t('nav.marketplace')}</Link></li>
              <li><Link to="/best-sellers">{t('nav.bestSellers')}</Link></li>
              <li><Link to="/pricing">{t('nav.pricing')}</Link></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-heading">{t('footer.company')}</h4>
            <ul className="footer-links">
              <li><Link to="/about">{t('aboutUs.title', 'About Us')}</Link></li>
              <li><Link to="/contact">{t('contact.title', 'Contact Us')}</Link></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-heading">{t('footer.resources')}</h4>
            <ul className="footer-links">
              <li><Link to="/dashboard/upload">{t('hero.startSelling', 'Start Selling')}</Link></li>
              <li><Link to="/rewards">{t('nav.rewards', 'Rewards')}</Link></li>
              <li><Link to="/contact">{t('footer.helpCenter')}</Link></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-heading">{t('footer.legal')}</h4>
            <ul className="footer-links">
              <li><Link to="/terms">{t('footer.termsOfService')}</Link></li>
              <li><Link to="/privacy">{t('footer.privacyPolicy')}</Link></li>
              <li>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(new Event('openCookieBanner'));
                  }}
                  className="footer-link-button"
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
                >
                  {t('footer.cookiePolicy')}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Nothi. {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}
