import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate, useNavigationType, useOutlet, matchPath } from 'react-router';
import { motion } from 'framer-motion';
import { ChevronLeft, Compass, Search, Library, MessageCircle, User, Bell, Settings, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { invalidateProductCache } from '../../api/productApi';
import { tap } from '../../lib/native';
import './AppShell.css';

/**
 * AppShell — the mobile app's chrome (Capacitor build only).
 * Replaces the website's Navbar/Footer/sidebar with:
 *  - a native-style top bar (back button, title that appears on scroll)
 *  - five root tabs in a floating bar (same glass pill as the site's mobile nav)
 *  - push/pop page transitions, per-tab scroll memory, pull to refresh
 */

const TABS = [
  { to: '/', label: 'Discover', icon: Compass, exact: true },
  { to: '/marketplace', label: 'Explore', icon: Search },
  { to: '/library', label: 'Library', icon: Library, auth: true },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle, auth: true },
  { to: '/me', label: 'Profile', icon: User },
];
const ROOTS = TABS.map((t) => t.to);

// Screen titles (large title on root tabs, small title in the bar elsewhere)
const TITLES = [
  ['/', 'Discover'], ['/marketplace', 'Explore'], ['/library', 'Library'], ['/dashboard/messages', 'Messages'], ['/me', 'Profile'],
  ['/product/:id', ''], ['/creator/:username', ''], ['/best-sellers', ''], ['/rewards', 'Rewards'],
  ['/notifications', 'Notifications'], ['/login', 'Sign in'], ['/onboarding', 'Welcome'], ['/about', 'About'],
  ['/contact', 'Contact'], ['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/downloads', 'Downloads'],
  ['/dashboard', 'Dashboard'], ['/dashboard/products', 'My products'], ['/dashboard/upload', 'Product'],
  ['/dashboard/analytics', 'Analytics'], ['/dashboard/payouts', 'Earnings'], ['/dashboard/settings', 'Settings'],
  ['/dashboard/purchases', 'Purchases'], ['/dashboard/wishlist', 'Wishlist'], ['/dashboard/following', 'Following'],
  ['/dashboard/badges', 'Badges'], ['/dashboard/subscription', 'Plan'],
];
function titleFor(pathname) {
  for (const [pattern, title] of TITLES) if (matchPath({ path: pattern, end: true }, pathname)) return title;
  return '';
}
const isRoot = (p) => ROOTS.includes(p);

// Pages that need a signed-in user (the dashboard group + Library/Messages)
const AUTH_PREFIXES = ['/dashboard', '/library'];

/** Current page; remounted by pull-to-refresh. */
function ScreenOutlet({ refreshKey }) {
  const outlet = useOutlet();
  return <div key={refreshKey} style={{ display: 'contents' }}>{outlet}</div>;
}

export default function AppShell() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, profile } = useAuth();
  const unread = useUnreadMessages();
  const { pathname } = location;

  const root = isRoot(pathname);
  const title = titleFor(pathname);

  // ── auth guard (same rules as the website's DashboardLayout)
  const needsAuth = AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  useEffect(() => {
    if (isLoading) return;
    if (needsAuth && !isAuthenticated) navigate('/login', { replace: true });
    else if (isAuthenticated && profile && (!profile.onboarding_completed || !profile.username) && pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true });
    }
  }, [isLoading, needsAuth, isAuthenticated, profile, pathname, navigate]);

  // ── the website's /pricing & checkout pages don't exist in the app (store rules)
  useEffect(() => {
    if (['/pricing', '/checkout/success', '/checkout/cancel'].includes(pathname)) navigate('/me', { replace: true });
  }, [pathname, navigate]);

  // ── transition direction: tab switch = crossfade, push = from right, back = from left
  // (derived during render from the previous path — React's "store info from previous renders" pattern)
  const [nav, setNav] = useState({ path: pathname, dir: 'fade' });
  if (nav.path !== pathname) {
    setNav({ path: pathname, dir: isRoot(pathname) && isRoot(nav.path) ? 'fade' : navType === 'POP' ? 'back' : 'push' });
  }
  const prevPath = useRef(pathname);

  // ── scroll memory per screen (saved on leave, restored before paint on arrival)
  const scrollMemory = useRef(new Map());
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => { lastY.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    const from = prevPath.current;
    if (from !== pathname) scrollMemory.current.set(from, lastY.current);
    prevPath.current = pathname;
    const y = navType === 'POP' || isRoot(pathname) ? (scrollMemory.current.get(pathname) ?? 0) : 0;
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    lastY.current = y;
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── top bar state
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > (root ? 44 : 4));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [root, pathname]);

  // ── pull to refresh (root tabs)
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const startY = useRef(null);
  const onTouchStart = (e) => { if (root && window.scrollY <= 0 && !refreshing) startY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    const d = e.touches[0].clientY - startY.current;
    setPull(d > 0 ? Math.min(110, d * 0.5) : 0);
  };
  const onTouchEnd = useCallback(() => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull > 70) {
      setRefreshing(true);
      tap('MEDIUM');
      invalidateProductCache();
      setRefreshKey((k) => k + 1);
      setTimeout(() => { setRefreshing(false); setPull(0); }, 700);
    } else setPull(0);
  }, [pull]);

  // Enter-only transitions: the new screen replaces the old one instantly and
  // slides/fades in. No exit phase, so navigation can never get stuck waiting
  // on an animation inside a page.
  const dir = nav.dir;
  const enterFrom = dir === 'fade' ? { opacity: 0 } : { opacity: 0, x: dir === 'push' ? 40 : -40 };

  return (
    <div className={`app-shell ${root ? 'is-root' : 'is-child'}`}>
      {/* ── top bar */}
      <header className={`app-bar ${scrolled ? 'scrolled' : ''}`}>
        <div className="app-bar-side">
          {!root && (
            <button type="button" className="app-icon-btn" aria-label="Back" onClick={() => { tap(); navigate(-1); }}>
              <ChevronLeft size={26} strokeWidth={2.2} />
            </button>
          )}
          {root && pathname === '/' && <img src="/logo.png" alt="Nothi" className="app-bar-logo" />}
        </div>
        <div className={`app-bar-title ${!root || scrolled ? 'show' : ''}`}>{title}</div>
        <div className="app-bar-side right">
          {pathname === '/' && isAuthenticated && (
            <Link to="/notifications" className="app-icon-btn" aria-label="Notifications" onClick={() => tap()}><Bell size={21} /></Link>
          )}
          {pathname === '/me' && isAuthenticated && (
            <Link to="/dashboard/settings" className="app-icon-btn" aria-label="Settings" onClick={() => tap()}><Settings size={21} /></Link>
          )}
        </div>
      </header>

      {/* ── pull to refresh indicator */}
      <div className="app-ptr" style={{ transform: `translateY(${pull - 40}px)`, opacity: Math.min(1, pull / 60) }} aria-hidden="true">
        <RefreshCw size={18} className={refreshing ? 'spin' : ''} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} />
      </div>

      {/* ── screen */}
      <main
        className="app-main"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={pull ? { transform: `translateY(${pull * 0.6}px)`, transition: 'none' } : undefined}
      >
        <motion.div
          key={pathname}
          initial={enterFrom}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: dir === 'fade' ? 0.18 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="app-screen"
        >
          {root && title && <h1 className="app-large-title">{title}</h1>}
          <ScreenOutlet refreshKey={refreshKey} />
        </motion.div>
      </main>

      {/* ── tab bar */}
      <nav className="app-tabs" aria-label="Main">
        {TABS.map(({ to, label, icon: Icon, exact, auth }) => {
          const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + '/');
          const target = auth && !isAuthenticated ? '/login' : to;
          return (
            <Link
              key={to}
              to={target}
              replace={isRoot(pathname)}
              className={`app-tab ${active ? 'active' : ''}`}
              onClick={(e) => {
                tap();
                if (active) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
              }}
            >
              <span className="app-tab-icon">
                {to === '/me' && isAuthenticated && profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className={`app-tab-avatar ${active ? 'active' : ''}`} />
                  : <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />}
                {to === '/dashboard/messages' && unread > 0 && <span className="app-tab-badge">{unread > 9 ? '9+' : unread}</span>}
              </span>
              <span className="app-tab-label">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
