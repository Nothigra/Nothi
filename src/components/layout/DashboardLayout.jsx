import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Package, ShoppingBag, BarChart3, 
  CreditCard, Settings, LogOut, Menu, X, Plus, Users, 
  Store, Search, Bell, Moon, Sun, Heart, Download, Shield, Palette, MessageSquare
} from 'lucide-react';
import { messagingService as mockMessagingService } from '../../lib/MessagingService';
import { getUserMessages, groupMessagesIntoConversations, subscribeToMessages } from '../../api/messageApi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useGamification } from '../../context/GamificationContext';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, isMockMode, logout, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { gamificationState } = useGamification();
  
  // Notification dot state
  const hasNewBadges = gamificationState && gamificationState.unlockedBadges.length > (gamificationState.lastSeenBadgesCount || 0);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!profile) {
      setUnreadMessages(0);
      return;
    }
    
    if (isMockMode) {
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

  useEffect(() => {
    // Only redirect if we are fully loaded and there is no authenticated session
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    } else if (!isLoading && profile && (!profile.onboarding_completed || !profile.username)) {
      navigate('/onboarding');
    }
  }, [isLoading, isAuthenticated, profile, navigate]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    if (window.confirm(t('nav.confirmSignOut', 'Are you sure you want to sign out?'))) {
      logout();
      navigate('/');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const mainLinks = [
    { name: 'Publish', path: '/dashboard/upload', icon: Plus },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Products', path: '/dashboard/products', icon: Package },
    { name: 'Following', path: '/dashboard/following', icon: Users },
    { name: 'Messages', path: '/dashboard/messages', icon: MessageSquare, badge: unreadMessages > 0 ? unreadMessages : null },
    { name: 'Wishlist', path: '/dashboard/wishlist', icon: Heart },
    { name: 'Purchases', path: '/dashboard/purchases', icon: Download },
    { name: 'My Badges', path: '/dashboard/badges', icon: Shield },
    { name: 'Withdrawals', path: '/dashboard/payouts', icon: CreditCard },
  ];

  const bottomLinks = [
    { name: 'My Shop', path: `/creator/${profile?.username || ''}`, icon: Store },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="dashboard-layout">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            className="dashboard-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}
        animate={{ width: isCollapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="sidebar-header" style={{ padding: '16px' }}>
          <Link to="/marketplace" className="btn btn-outline w-full flex-center gap-xs" style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', border: 'none', background: 'var(--color-bg-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            {!isCollapsed && <span>Back to Marketplace</span>}
          </Link>
        </div>

        <div className="sidebar-content" style={{ paddingTop: '24px' }}>
          <nav className="sidebar-nav">
            {mainLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              const isPublish = link.name === 'Publish';
              
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? link.name : ''}
                  style={isPublish ? { 
                    backgroundColor: 'var(--color-accent)', 
                    color: 'white', 
                    marginBottom: '16px',
                    fontWeight: 600
                  } : {}}
                >
                  <Icon size={20} className="link-icon" style={isPublish ? { color: 'white' } : {}} />
                  {!isCollapsed && <span className="link-text">{link.name}</span>}
                  {link.name === 'My Badges' && hasNewBadges && (
                    <span className="w-2 h-2 bg-danger rounded-full ml-auto mr-sm"></span>
                  )}
                  {!isCollapsed && link.badge && (
                    <span className="sidebar-badge">{link.badge}</span>
                  )}
                  {isActive && !isCollapsed && !isPublish && (
                    <motion.div 
                      className="active-indicator"
                      layoutId="activeIndicator"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
            
            <div className="sidebar-divider" style={{ margin: '16px 0', borderTop: '1px solid var(--color-border)' }}></div>

            {bottomLinks.map((link, index) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <div key={link.path}>
                  <Link
                    to={link.path}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    title={isCollapsed ? link.name : ''}
                  >
                    <Icon size={20} className="link-icon" />
                    {!isCollapsed && <span className="link-text">{link.name}</span>}
                    {isActive && !isCollapsed && (
                      <motion.div 
                        className="active-indicator"
                        layoutId="activeIndicatorBottom"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: 'auto' }}>
          <button className="sidebar-link logout-btn" onClick={handleLogout} title={isCollapsed ? 'Logout' : ''}>
            <LogOut size={20} className="link-icon" />
            {!isCollapsed && <span className="link-text">Log Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className={`dashboard-main ${isCollapsed ? 'collapsed' : 'expanded'}`}>
        {/* Top Navbar */}
        <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 32px' }}>
          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="header-action-btn flex-center" onClick={toggleTheme} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              {theme === 'light' ? <Sun size={18} /> : theme === 'custom' ? <Palette size={18} className="text-accent" /> : <Moon size={18} />}
            </button>

            <Link to="/dashboard/settings" className="header-profile" style={{ display: 'flex', alignItems: 'center' }}>
              <img 
                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=random`} 
                alt="Profile" 
                className="profile-avatar" 
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="dashboard-content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
