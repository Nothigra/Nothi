import { Activity, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Link, useLocation, useNavigate, useNavigationType, useOutlet, matchPath,
  UNSAFE_LocationContext as LocationContext,
} from 'react-router';
import { ChevronLeft, Compass, Search, MessageCircle, User, Bell, Settings, RefreshCw, Share2, Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { invalidateProductCache } from '../../api/productApi';
import { tap, platform, shareLink, enablePush } from '../../lib/native';
import { supabase } from '../../lib/supabase';
import PageFallback from '../common/PageFallback';
import { useScreenTitleFor } from '../../lib/screenTitle';
import { startChat, useChat } from '../../lib/chatStore';
import './AppShell.css';

/**
 * AppShell — the mobile app's chrome (Capacitor build only).
 *
 * Performance model (what makes it feel native):
 *  - The five tabs are KEPT ALIVE: each one stays mounted inside a React
 *    <Activity> and is only hidden when you leave it. Coming back is instant,
 *    with its scroll position, filters and loaded data intact.
 *    A hidden tab sees a frozen copy of the location it was last shown with,
 *    so it never reacts to other screens' URLs.
 *  - Pushed screens (product, creator, settings…) mount on top with a CSS
 *    transform animation (GPU only, no JS per frame).
 *  - Pull-to-refresh and the iOS edge-swipe-back move the DOM directly
 *    (refs, no React re-render per touch move).
 */

const TABS = [
  { to: '/', label: 'Discover', icon: Compass, exact: true },
  { to: '/marketplace', label: 'Explore', icon: Search },
  { to: '/publish', label: 'Publish', icon: Plus, auth: true, center: true },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle, auth: true },
  { to: '/me', label: 'Profile', icon: User },
];
// Root tabs are kept alive; the centre "+" opens the publish flow on top instead
const ROOTS = TABS.filter((t) => !t.center).map((t) => t.to);
// Full-screen flows: no tab bar (they have their own bottom actions)
const IMMERSIVE = ['/publish'];
const isImmersive = (p) => IMMERSIVE.includes(p) || p.startsWith('/messages/');
const isRoot = (p) => ROOTS.includes(p);

// Screen titles (large title on root tabs, small title in the bar elsewhere)
const TITLES = [
  ['/', 'Discover'], ['/marketplace', 'Explore'], ['/library', 'Library'], ['/dashboard/messages', 'Messages'], ['/me', 'Profile'], ['/publish', ''], ['/menu', 'Settings'], ['/messages/:id', ''],
  ['/search', 'Search'], ['/product/:id', ''], ['/creator/:username', ''], ['/best-sellers', ''], ['/rewards', 'Rewards'],
  ['/notifications', 'Notifications'], ['/login', 'Sign in'], ['/onboarding', 'Welcome'], ['/about', ''],
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

// Pages that need a signed-in user (the dashboard group + Library/Messages)
const AUTH_PREFIXES = ['/dashboard', '/library', '/publish'];

// iOS has no system back gesture inside a WebView: we provide the edge swipe.
// Android has its own system back gesture (handled in native.js).
const EDGE_SWIPE = platform !== 'android';

export default function AppShell() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const outlet = useOutlet();
  const { user, isAuthenticated, isLoading, profile, isMockMode } = useAuth();
  const chat = useChat();
  const unread = chat.conversations.reduce((n, c) => n + (c.unread || 0), 0);
  const { pathname } = location;

  const root = isRoot(pathname);
  const dynamicTitle = useScreenTitleFor(pathname);
  const title = dynamicTitle ?? titleFor(pathname);

  // ── auth guard (same rules as the website's DashboardLayout)
  const needsAuth = AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  useEffect(() => {
    if (isLoading) return;
    if (needsAuth && !isAuthenticated) navigate('/login', { replace: true });
    else if (isAuthenticated && profile && (!profile.onboarding_completed || !profile.username) && pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true });
    }
  }, [isLoading, needsAuth, isAuthenticated, profile, pathname, navigate]);

  // ── messages: one live copy shared by the Messages tab and chat screens
  useEffect(() => { if (!isLoading) startChat(user?.id ?? null, isMockMode); }, [user?.id, isLoading, isMockMode]);

  // ── push notifications: register this phone once someone is signed in
  const signedInId = user?.id;
  useEffect(() => {
    if (signedInId && !isLoading) enablePush(supabase);
  }, [signedInId, isLoading]);

  // ── the website's upload form → the app's step-by-step flow (keeps ?edit and the product state)
  useEffect(() => {
    if (pathname === '/dashboard/upload') navigate({ pathname: '/publish', search: location.search }, { replace: true, state: location.state });
    // The seller dashboard and product list live in Profile › My shop in the app
    if (pathname === '/dashboard' || pathname === '/dashboard/products') {
      try { localStorage.setItem('nothi-profile-segment', 'shop'); } catch { /* ignore */ }
      navigate('/me', { replace: true });
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── the website's /pricing & checkout pages don't exist in the app (store rules)
  useEffect(() => {
    if (['/pricing', '/checkout/success', '/checkout/cancel'].includes(pathname)) navigate('/me', { replace: true });
  }, [pathname, navigate]);

  // ── transition direction, derived from the previous path during render
  const [nav, setNav] = useState({ path: pathname, dir: 'none', swiped: false });
  if (nav.path !== pathname) {
    let dir;
    if (isRoot(pathname)) dir = navType === 'POP' && !isRoot(nav.path) ? 'back' : 'fade'; // tab jump = crossfade
    else dir = navType === 'POP' ? 'back' : 'push';
    if (nav.swiped) dir = 'none'; // the finger already did the animation
    setNav({ path: pathname, dir, swiped: false });
  }
  const enterClass = nav.dir === 'none' ? '' : `app-enter-${nav.dir}`;

  // ── kept-alive tabs: { [tabPath]: { element, location } }
  const userId = user?.id ?? null;
  const [kept, setKept] = useState({ owner: userId, tabs: {} });
  if (kept.owner !== userId) {
    // signed in/out: drop tabs that hold another user's data
    setKept({ owner: userId, tabs: {} });
  } else if (root && outlet && kept.tabs[pathname]?.location !== location) {
    setKept({ owner: userId, tabs: { ...kept.tabs, [pathname]: { element: outlet, location } } });
  }

  // ── scroll memory per screen (saved on leave, restored before paint)
  const scrollMemory = useRef(new Map());
  const lastY = useRef(0);
  const prevPath = useRef(pathname);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      lastY.current = window.scrollY;
      setScrolled(window.scrollY > (isRoot(prevPath.current) ? 44 : 4));
    };
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
    setScrolled(y > (isRoot(pathname) ? 44 : 4));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── gestures: pull to refresh (root tabs) and edge swipe back (iOS).
  // Both move the DOM directly — one React update when the finger lifts.
  const [refreshKeys, setRefreshKeys] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const mainRef = useRef(null);
  const ptrRef = useRef(null);
  const pushedRef = useRef(null);
  const gesture = useRef(null); // { kind: 'pull' | 'swipe', x0, y0, d, t0 }

  const setPullVisual = (d, animate) => {
    const main = mainRef.current, ptr = ptrRef.current;
    if (!main || !ptr) return;
    main.style.transition = animate ? '' : 'none';
    main.style.transform = d ? `translate3d(0, ${d * 0.6}px, 0)` : '';
    ptr.style.transition = animate ? '' : 'none';
    ptr.style.transform = `translate3d(0, ${d - 40}px, 0)`;
    ptr.style.opacity = String(Math.min(1, d / 60));
    const icon = ptr.firstElementChild;
    if (icon && !icon.classList.contains('spin')) icon.style.transform = `rotate(${d * 3}deg)`;
  };
  const setSwipeVisual = (dx, animate) => {
    const el = pushedRef.current;
    if (!el) return;
    el.style.animation = 'none';
    el.style.transition = animate ? 'transform .24s cubic-bezier(.22,1,.36,1), opacity .24s ease' : 'none';
    el.style.transform = dx ? `translate3d(${dx}px, 0, 0)` : '';
    el.style.opacity = dx ? String(1 - Math.min(0.5, dx / window.innerWidth)) : '';
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    if (!root && EDGE_SWIPE && t.clientX < 24) {
      gesture.current = { kind: 'swipe', x0: t.clientX, y0: t.clientY, d: 0, t0: performance.now() };
    } else if (root && window.scrollY <= 0 && !refreshing) {
      gesture.current = { kind: 'pull', x0: t.clientX, y0: t.clientY, d: 0, t0: performance.now() };
    }
  };
  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches[0];
    if (g.kind === 'pull') {
      const dy = t.clientY - g.y0;
      g.d = dy > 0 ? Math.min(110, dy * 0.5) : 0;
      setPullVisual(g.d, false);
    } else {
      const dx = Math.max(0, t.clientX - g.x0);
      if (g.d === 0 && Math.abs(t.clientY - g.y0) > dx + 6) { gesture.current = null; return; } // it's a vertical scroll
      g.d = dx;
      setSwipeVisual(dx, false);
    }
  };
  const onTouchEnd = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'pull') {
      if (g.d > 70) {
        tap('MEDIUM');
        setRefreshing(true);
        setPullVisual(56, true);
        invalidateProductCache();
        setRefreshKeys((k) => ({ ...k, [pathname]: (k[pathname] || 0) + 1 }));
        setTimeout(() => { setRefreshing(false); setPullVisual(0, true); }, 700);
      } else if (g.d > 0) setPullVisual(0, true);
    } else if (g.d > 0) {
      const w = window.innerWidth;
      const velocity = g.d / Math.max(1, performance.now() - g.t0); // px/ms
      if (g.d > w * 0.33 || (velocity > 0.5 && g.d > 40)) {
        setSwipeVisual(w, true);
        setTimeout(() => { setNav((n) => ({ ...n, swiped: true })); navigate(-1); }, 190);
      } else setSwipeVisual(0, true);
    }
  }, [pathname, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Share button on product & creator pages
  const shareable = !!(matchPath('/product/:id', pathname) || matchPath('/creator/:username', pathname));
  const [toast, setToast] = useState('');

  // Tabs to render: every visited tab (kept alive) + the current one
  const tabPaths = ROOTS.filter((p) => kept.tabs[p] || (root && p === pathname));

  return (
    <div className={`app-shell ${root ? 'is-root' : 'is-child'} ${isImmersive(pathname) ? 'is-immersive' : ''}`}>
      {/* ── top bar */}
      <header className={`app-bar ${scrolled ? 'scrolled' : ''}`}>
        <div className="app-bar-side">
          {!root && (
            <button type="button" className="app-icon-btn" aria-label={IMMERSIVE.includes(pathname) ? 'Close' : 'Back'} onClick={() => { tap(); navigate(-1); }}>
              {IMMERSIVE.includes(pathname) ? <X size={24} strokeWidth={2.2} /> : <ChevronLeft size={26} strokeWidth={2.2} />}
            </button>
          )}
          {root && pathname === '/' && <img src="/logo.png" alt="Nothi" className="app-bar-logo" />}
        </div>
        <div className={`app-bar-title ${!root || scrolled ? 'show' : ''}`}>{title}</div>
        <div className="app-bar-side right">
          {pathname === '/' && isAuthenticated && (
            <Link to="/notifications" className="app-icon-btn" aria-label="Notifications" onClick={() => tap()}><Bell size={21} /></Link>
          )}
          {shareable && (
            <button
              type="button"
              className="app-icon-btn"
              aria-label="Share"
              onClick={async () => {
                tap();
                const heading = document.querySelector('.app-pushed h1')?.textContent?.trim();
                const res = await shareLink({ title: heading || 'Nothi', text: heading ? `${heading} on Nothi` : 'Nothi', path: pathname });
                if (res === 'copied') { setToast('Link copied'); setTimeout(() => setToast(''), 1800); }
              }}
            >
              <Share2 size={20} />
            </button>
          )}
          {pathname === '/me' && isAuthenticated && (
            <Link to="/menu" className="app-icon-btn" aria-label="Settings" onClick={() => tap()}><Settings size={21} /></Link>
          )}
        </div>
      </header>

      {/* ── pull to refresh indicator */}
      <div ref={ptrRef} className="app-ptr" style={{ opacity: 0, transform: 'translate3d(0,-40px,0)' }} aria-hidden="true">
        <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
      </div>

      {/* ── screens */}
      <main
        ref={mainRef}
        className="app-main"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {tabPaths.map((p) => {
          const active = root && p === pathname;
          const entry = kept.tabs[p];
          const element = active ? outlet : entry?.element;
          const loc = active ? location : entry?.location;
          const tabTitle = titleFor(p);
          return (
            <Activity key={p} mode={active ? 'visible' : 'hidden'}>
              <div className={`app-screen ${active ? enterClass : ''}`}>
                {tabTitle && <h1 className="app-large-title">{tabTitle}</h1>}
                <LocationContext.Provider value={{ location: loc, navigationType: active ? navType : 'POP' }}>
                  <Suspense fallback={<PageFallback />}>
                    <div key={refreshKeys[p] || 0} style={{ display: 'contents' }}>{element}</div>
                  </Suspense>
                </LocationContext.Provider>
              </div>
            </Activity>
          );
        })}

        {!root && (
          <div key={pathname} ref={pushedRef} className={`app-screen app-pushed ${enterClass}`}>
            <Suspense fallback={<PageFallback />}>{outlet}</Suspense>
          </div>
        )}
      </main>

      {toast && <div className="app-toast" role="status">{toast}</div>}

      {/* ── tab bar */}
      <nav className="app-tabs" aria-label="Main">
        {TABS.map(({ to, label, icon: Icon, exact, auth, center }) => {
          if (center) {
            return (
              <Link
                key={to}
                to={isAuthenticated ? to : '/login'}
                className="app-tab app-tab-center"
                aria-label={label}
                onClick={() => tap('MEDIUM')}
              >
                <span className="app-tab-plus"><Icon size={26} strokeWidth={2.4} /></span>
              </Link>
            );
          }
          const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + '/');
          // A kept tab reopens exactly where you left it (e.g. Explore with its category)
          const keptLoc = kept.tabs[to]?.location;
          const target = auth && !isAuthenticated ? '/login' : keptLoc ? { pathname: keptLoc.pathname, search: keptLoc.search } : to;
          return (
            <Link
              key={to}
              to={target}
              replace={isRoot(pathname)}
              className={`app-tab ${active ? 'active' : ''}`}
              onClick={(e) => {
                tap();
                if (active && pathname === to) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
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
