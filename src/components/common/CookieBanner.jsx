import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Info, X } from 'lucide-react';
import './CookieBanner.css';

// ⚠️ FUTURE CONSENT SYSTEM REQUIRED:
// If analytics (Google Analytics, etc.) or marketing cookies are ever added, 
// this simple banner MUST be upgraded to a full consent management system (CMP).
// It will need granular checkboxes (Necessary vs Analytics vs Marketing) and a clear "Reject All" option.
// Currently, since we ONLY use strictly necessary cookies (Supabase auth), a simple acknowledgment is legally sufficient.

const translations = {
  fr: {
    title: "🍪 Respect de votre vie privée",
    text1: "Nothi utilise uniquement des cookies strictement nécessaires au fonctionnement du site (maintien de votre connexion, sécurité). Nous n'utilisons aucun cookie de suivi publicitaire ou d'analyse pour le moment.",
    text2: "En continuant à naviguer, vous acceptez l'utilisation de ces cookies essentiels.",
    more: "En savoir plus",
    accept: "J'ai compris"
  },
  en: {
    title: "🍪 Respecting your privacy",
    text1: "Nothi only uses cookies that are strictly necessary for the site to function (keeping you logged in, security). We do not use any advertising or analytics tracking cookies at this time.",
    text2: "By continuing to browse, you accept the use of these essential cookies.",
    more: "Learn more",
    accept: "Got it"
  },
  es: {
    title: "🍪 Respeto a tu privacidad",
    text1: "Nothi solo utiliza cookies que son estrictamente necesarias para el funcionamiento del sitio (mantener su sesión, seguridad). No utilizamos cookies de seguimiento publicitario ni analíticas en este momento.",
    text2: "Al continuar navegando, aceptas el uso de estas cookies esenciales.",
    more: "Saber más",
    accept: "Entendido"
  }
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
    console.log('CookieBanner: Not mounted yet');
    return null;
  }
  
  console.log('CookieBanner: Rendering with isVisible=', isVisible);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="cookie-banner-wrapper"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="cookie-banner-content">
            <div className="cookie-banner-header">
              <h3 className="cookie-banner-title">{tLocal.title}</h3>
              <button 
                className="cookie-banner-close" 
                onClick={handleAcknowledge}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="cookie-banner-body">
              <p>{tLocal.text1}</p>
              <p className="mt-xs text-sm text-secondary">{tLocal.text2}</p>
            </div>
            
            <div className="cookie-banner-actions">
              <Link to="/privacy" className="cookie-banner-link" onClick={() => setIsVisible(false)}>
                <Info size={14} />
                {tLocal.more}
              </Link>
              <button className="btn btn-primary btn-sm" onClick={handleAcknowledge}>
                {tLocal.accept}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
