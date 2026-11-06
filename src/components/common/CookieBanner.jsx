import { useState, useEffect } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import './CookieBanner.css';

// ⚠️ FUTURE CONSENT SYSTEM REQUIRED:
// If analytics (Google Analytics, etc.) or marketing cookies are ever added, 
// this simple banner MUST be upgraded to a full consent management system (CMP).
// It will need granular checkboxes (Necessary vs Analytics vs Marketing) and a clear "Reject All" option.
// Currently, since we ONLY use strictly necessary cookies (Supabase auth), a simple acknowledgment is legally sufficient.

const translations = {
  fr: { text: "Nothi utilise uniquement des cookies essentiels (connexion, sécurité). Aucun cookie publicitaire ni de suivi.", more: "En savoir plus", accept: "OK" },
  en: { text: "Nothi only uses essential cookies (sign-in, security). No advertising or tracking cookies.", more: "Learn more", accept: "OK" },
  es: { text: "Nothi solo usa cookies esenciales (sesión, seguridad). Sin cookies publicitarias ni de seguimiento.", more: "Saber más", accept: "OK" },
};

export default function CookieBanner() {
  const { i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const lang = ['en', 'fr', 'es'].includes(i18n.language?.split('-')[0]) 
    ? i18n.language.split('-')[0] 
    : 'en';
    
  const tLocal = translations[lang];

  useEffect(() => {
    setMounted(true);
    // Check if user has already acknowledged
    const hasAcknowledged = localStorage.getItem('cookie_consent_ack');
    if (!hasAcknowledged) {
      // Small delay so it doesn't jarringly pop up the exact millisecond the page loads
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Listen for custom event to reopen banner from Footer (Phase 5)
    const handleOpenBanner = () => setIsVisible(true);
    window.addEventListener('openCookieBanner', handleOpenBanner);
    return () => window.removeEventListener('openCookieBanner', handleOpenBanner);
  }, []);

  const handleAcknowledge = () => {
    localStorage.setItem('cookie_consent_ack', 'true');
    setIsVisible(false);
  };

  // Don't render anything until client-side hydration is complete
  if (!mounted) {
    return null;
  }
  

  // One quiet line at the bottom: essential cookies only need to be explained, not accepted
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="cookie-note"
          role="region"
          aria-label="Cookies"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <p>
            {tLocal.text}{' '}
            <Link to="/privacy" onClick={() => setIsVisible(false)}>{tLocal.more}</Link>
          </p>
          <button className="cookie-note-ok" onClick={handleAcknowledge}>{tLocal.accept}</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
