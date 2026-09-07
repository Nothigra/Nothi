import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
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
            <div className="social-links">
              <a href="#" aria-label="Twitter">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              <a href="#" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="#" aria-label="Youtube">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
              </a>
              <a href="#" aria-label="Github">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              </a>
            </div>
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
              <li><Link to="/">{t('footer.careers')}</Link></li>
              <li><Link to="/">{t('footer.blog')}</Link></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-heading">{t('footer.resources')}</h4>
            <ul className="footer-links">
              <li><Link to="/">{t('footer.helpCenter')}</Link></li>
              <li><Link to="/">{t('footer.community')}</Link></li>
              <li><Link to="/">{t('footer.developers')}</Link></li>
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
