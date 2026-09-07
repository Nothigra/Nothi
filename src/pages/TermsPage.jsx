import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { termsContent } from '../data/legal/termsContent';
import './ContactPage.css'; // Reuse static page layout classes
import './LegalPage.css'; // Add some legal specific styling

export default function TermsPage() {
  const { t, i18n } = useTranslation();
  
  // Local state for the document language, independent of global i18n
  const defaultLang = ['en', 'fr', 'es'].includes(i18n.language?.split('-')[0]) 
    ? i18n.language.split('-')[0] 
    : 'en';
    
  const [docLang, setDocLang] = useState(defaultLang);

  const getDocTitle = () => {
    switch(docLang) {
      case 'fr': return "Conditions Générales d'Utilisation et de Vente";
      case 'es': return "Términos de Servicio";
      default: return "Terms of Service";
    }
  };

  return (
    <div className="static-page legal-page">
      <div className="static-header">
        <motion.h1 
          className="static-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {getDocTitle()}
        </motion.h1>
      </div>

      <motion.div 
        className="legal-content-wrapper"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="language-selector-local">
          <button 
            className={`btn-local-lang ${docLang === 'en' ? 'active' : ''}`}
            onClick={() => setDocLang('en')}
          >
            EN
          </button>
          <button 
            className={`btn-local-lang ${docLang === 'fr' ? 'active' : ''}`}
            onClick={() => setDocLang('fr')}
          >
            FR
          </button>
          <button 
            className={`btn-local-lang ${docLang === 'es' ? 'active' : ''}`}
            onClick={() => setDocLang('es')}
          >
            ES
          </button>
        </div>

        <div className="legal-document prose">
          {termsContent[docLang]}
        </div>
      </motion.div>
    </div>
  );
}
