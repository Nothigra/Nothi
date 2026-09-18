import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Menu, X, Sun, Moon, ShoppingCart, Heart, Gift, Palette, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useGamification } from '../../context/GamificationContext';
import { languages } from '../../config/i18n';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { messagingService as mockMessagingService } from '../../lib/MessagingService';
import { seedFakeConversationsIfEmpty } from '../../lib/accountStore';
import { getUserMessages, groupMessagesIntoConversations, subscribeToMessages } from '../../api/messageApi';
import AvatarFrame from '../common/AvatarFrame';
import MobileMenu from './MobileMenu';
import './Navbar.css';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { items: cartItems, openCart } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { gamificationState, hasUnclaimedReward } = useGamification();
  const hasNewXp = gamificationState && gamificationState.xp > (gamificationState.lastSeenXp || 0);
  const hasNewBadges = gamificationState && gamificationState.unlockedBadges.length > (gamificationState.lastSeenBadgesCount || 0);
  const location = useLocation();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const { isAuthenticated, profile, isMockMode, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!profile) {
      setUnreadMessages(0);
      return;
    }
    
    if (isMockMode) {
      seedFakeConversationsIfEmpty(profile.id);
      const updateUnread = () => {
        const convs = mockMessagingService.getUserConversations(profile.id);
        const count = convs.reduce((acc, c) => {
          const isBuyer = c.buyerId === profile.id;
          return acc + (isBuyer ? (c.unreadCountBuyer || 0) : (c.unreadCountSeller || 0));
        }, 0);
        setUnreadMessages(count);
      };
      updateUnread();
      return mockMessagingService.subscribe(updateUnread);
    }

    let isMounted = true;
    const fetchUnread = async () => {
      const msgs = await getUserMessages(profile.id);
      if (isMounted) {
        const convs = groupMessagesIntoConversations(msgs, profile.id);
        const count = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadMessages(count);
      }
    };

    fetchUnread();
    const unsub = subscribeToMessages(profile.id, fetchUnread);
    return () => {
      isMounted = false;
      unsub();
    };
  }, [profile, isMockMode]);

  const navLinks = [
    { path: '/', label: 'home' },
    { path: '/marketplace', label: 'marketplace' },
    { path: '/best-sellers', label: 'bestSellers' },
    { path: '/pricing', label: 'pricing' }
  ];



  const toggleLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    setIsLangOpen(false);
  };

  return (
    <>
      <nav className={`navbar ${isScrolled ? 'is-scrolled' : ''}`}>
        <div className="navbar-container">
          
          {/* Left: Logo */}
          <div className="navbar-left">
            <Link to="/" className="navbar-logo-wrapper">
              <img src="/logo.png" alt="Nothi Logo" className="navbar-logo-img" />
              <span className="navbar-logo">Nothi</span>
            </Link>
          </div>

          {/* Center: Desktop Nav Links */}
          <div className="navbar-center hidden-mobile">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
              return (
                <Link 
                  key={link.path} 
                  to={link.path} 
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  {t(`nav.${link.label}`)}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active-indicator"
                      className="navbar-active-indicator"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: Actions */}
          <div className="navbar-right">
            {/* Theme Toggle */}
            <div className="lang-dropdown-wrapper hidden-mobile" style={{ position: 'relative' }}>
              <button 
                className="action-btn flex items-center gap-1"
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Sun size={18} /> : theme === 'custom' ? <Palette size={18} className="text-accent" /> : <Moon size={18} />}
              </button>
              
              <AnimatePresence>
                {isThemeOpen && (
                  <motion.div 
                    className="lang-dropdown"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{ right: 0, minWidth: '140px', padding: '8px' }}
                  >
                    <button onClick={() => { toggleTheme('light'); setIsThemeOpen(false); }} className={`nav-link flex items-center gap-2 w-full text-left ${theme === 'light' ? 'text-primary font-bold' : ''}`} style={{ padding: '8px 12px' }}>
                      <Sun size={16} /> Light
                    </button>
                    <button onClick={() => { toggleTheme('dark'); setIsThemeOpen(false); }} className={`nav-link flex items-center gap-2 w-full text-left ${theme === 'dark' ? 'text-primary font-bold' : ''}`} style={{ padding: '8px 12px' }}>
                      <Moon size={16} /> Dark
                    </button>
                    {profile?.custom_theme && (
                      <button onClick={() => { toggleTheme('custom'); setIsThemeOpen(false); }} className={`nav-link flex items-center gap-2 w-full text-left ${theme === 'custom' ? 'text-accent font-bold' : ''}`} style={{ padding: '8px 12px' }}>
                        <Palette size={16} className={theme === 'custom' ? 'text-accent' : ''} /> Custom
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language Selector */}
            <div className="lang-dropdown-wrapper hidden-mobile">
              <button 
                className="action-btn text-sm font-medium flex items-center gap-1"
                onClick={() => setIsLangOpen(!isLangOpen)}
              >
                {languages.find(l => l.code === (i18n.language || 'en').split('-')[0])?.flag || '🇬🇧'}
                <span style={{ marginLeft: '4px' }}>{(i18n.language || 'en').split('-')[0].toUpperCase()}</span>
              </button>
              
              <AnimatePresence>
                {isLangOpen && (
                  <motion.div 
                    className="lang-dropdown"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {languages.map((lang) => {
                      const isActiveLang = (i18n.language || 'en').startsWith(lang.code);
                      return (
                        <button 
                          key={lang.code}
                          onClick={() => toggleLanguage(lang.code)} 
                          className={`lang-option ${isActiveLang ? 'active' : ''}`}
                        >
                          <span className="lang-flag">{lang.flag}</span>
                          <span className="lang-name">{lang.name}</span>
                          {isActiveLang && (
                            <motion.div layoutId="active-lang-dot" className="active-lang-dot" />
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Rewards */}
            <Link to="/rewards" className="action-btn relative" title="Rewards">
              <Gift size={16} />
              {(hasUnclaimedReward || hasNewXp) && (
                <span className={`absolute top-1 right-1 w-2 h-2 rounded-full border-2 border-bg-card ${hasUnclaimedReward ? 'bg-danger' : 'bg-accent'}`}></span>
              )}
            </Link>

            {/* Wishlist */}
            <Link to="/dashboard/wishlist" className="action-btn hidden-mobile">
              <Heart size={16} />
              {wishlistItems.length > 0 && (
                <span className="badge-counter">{wishlistItems.length}</span>
              )}
            </Link>

            {/* Cart */}
            <button className="action-btn" onClick={openCart} aria-label={t('cart.title', 'Your Cart')}>
              <ShoppingCart size={16} />
              {cartItems.length > 0 && (
                <span className="badge-counter">{cartItems.length}</span>
              )}
            </button>

            {/* Sign In / Profile */}
            {!isAuthenticated ? (
              <Link to="/login" className="btn btn-outline btn-sm hidden-mobile">
                {t('nav.signIn', 'Sign In')}
              </Link>
            ) : (
              <div className="lang-dropdown-wrapper hidden-mobile" style={{position: 'relative'}}>
                <button 
                  className="action-btn !bg-transparent p-0 relative"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                >
                  <AvatarFrame tier={profile?.tier} imageUrl={profile?.avatar_url || (profile?.shop_settings?.profile_image_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=random`)} size="sm" />
                  {(hasNewBadges || unreadMessages > 0) && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-danger rounded-full border-2 border-bg z-10"></span>
                  )}
                </button>
                
                {isProfileOpen && (
                  <div className="lang-dropdown" style={{ right: 0, minWidth: '160px', padding: '8px' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{profile?.username || 'Creator'}</div>
                    </div>
                    <Link to="/dashboard" className="nav-link flex items-center justify-between" style={{ display: 'flex', padding: '8px 12px' }} onClick={() => setIsProfileOpen(false)}>
                      <span>{t('nav.dashboard', 'Dashboard')}</span>
                      {(hasNewBadges || unreadMessages > 0) && <span className="w-2 h-2 bg-danger rounded-full"></span>}
                    </Link>
                    <Link to={`/creator/${profile?.username}`} className="nav-link" style={{ display: 'block', padding: '8px 12px' }} onClick={() => setIsProfileOpen(false)}>{t('profile.myShop', 'My Shop')}</Link>
                    <Link to="/dashboard/settings" className="nav-link" style={{ display: 'block', padding: '8px 12px' }} onClick={() => setIsProfileOpen(false)}>{t('nav.settings', 'Settings')}</Link>
                    <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '8px 0' }}></div>
                    <button onClick={() => { if(window.confirm(t('nav.confirmSignOut', 'Are you sure you want to sign out?'))) { logout(); setIsProfileOpen(false); } }} className="nav-link" style={{ width: '100%', textAlign: 'left', padding: '8px 12px', color: 'var(--color-error, #ef4444)' }}>
                      {t('nav.signOut', 'Log Out')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button 
              className="action-btn hamburger-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        navLinks={navLinks}
      />
    </>
  );
}
