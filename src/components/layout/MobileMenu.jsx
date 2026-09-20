import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Globe, User, LogIn, ChevronDown, DollarSign, Palette } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { languages } from '../../config/i18n';
import './MobileMenu.css';

export default function MobileMenu({ isOpen, onClose, navLinks }) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  
  const [isLangOpen, setIsLangOpen] = useState(false);

  // UX Improvements: Lock scroll and Esc listener
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsLangOpen(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsLangOpen(false);
  };

  const activeLang = languages.find(l => l.code === i18n.language) || languages[0];

  return (
    <div className={`mobile-menu-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className={`mobile-menu-content ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-menu-body">
          <nav className="mobile-nav-links">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="mobile-nav-link"
                onClick={onClose}
              >
                {t(`nav.${link.label}`)}
              </Link>
            ))}
          </nav>

          <div className="divider" style={{ margin: 'var(--space-md) 0' }}></div>

          <div className="mobile-menu-actions">
            <button onClick={toggleTheme} className="mobile-action-item">
              <div className="action-icon">
                {theme === 'light' ? <Sun size={20} /> : theme === 'custom' ? <Palette size={20} className="text-accent" /> : <Moon size={20} />}
              </div>
              <span>{theme === 'light' ? 'Light Mode' : theme === 'custom' ? 'Custom Theme' : 'Dark Mode'}</span>
            </button>

            {/* Language Selector */}
            <div className="mobile-dropdown-container">
              <button 
                className="mobile-action-item"
                onClick={() => setIsLangOpen(!isLangOpen)}
              >
                <div className="action-icon"><Globe size={20} /></div>
                <span style={{ flex: 1, textAlign: 'left' }}>Language: {activeLang.flag} {activeLang.code.toUpperCase()}</span>
                <ChevronDown size={16} style={{ transform: isLangOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              
              <div className={`mobile-dropdown-content ${isLangOpen ? 'open' : ''}`}>
                <div className="mobile-dropdown-grid">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      className={`lang-btn ${i18n.language === lang.code ? 'active' : ''}`}
                      onClick={() => changeLanguage(lang.code)}
                    >
                      {lang.flag} {lang.code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="mobile-menu-footer">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="btn btn-primary w-full flex-center gap-sm" onClick={onClose}>
                <User size={18} />
                {t('nav.dashboard')}
              </Link>
              <button 
                onClick={() => { if(window.confirm(t('nav.confirmSignOut', 'Are you sure you want to sign out?'))) { logout(); onClose(); } }} 
                className="btn btn-outline w-full flex-center gap-sm mt-sm"
              >
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary w-full flex-center gap-sm" onClick={onClose}>
              <LogIn size={18} />
              {t('nav.signIn')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
