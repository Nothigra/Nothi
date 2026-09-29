/**
 * native.js — everything specific to the Nothi mobile app (Capacitor).
 *
 * The app ships the SAME React code as the website. `isNativeApp` switches on
 * the mobile shell (tab bar, native headers) and the store-compliant commerce
 * rules. On the website every helper here degrades to the normal web behaviour.
 *
 * Browser preview of the app shell (for development/testing only):
 *   open any page with ?app-preview=1   (turn off with ?app-preview=0)
 */
import { Capacitor } from '@capacitor/core';

const PREVIEW_KEY = 'nothi-app-preview';

function readPreviewFlag() {
  try {
    const q = new URLSearchParams(window.location.search).get('app-preview');
    if (q === '1') localStorage.setItem(PREVIEW_KEY, '1');
    if (q === '0') localStorage.removeItem(PREVIEW_KEY);
    return localStorage.getItem(PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

export const isNativePlatform = Capacitor.isNativePlatform();
export const isNativeApp = isNativePlatform || readPreviewFlag();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// Custom URL scheme the app is registered for (Android intent filter / iOS URL type).
// Used to come back into the app after Google/Discord sign-in.
export const APP_SCHEME = 'app.nothi.mobile';
export const OAUTH_REDIRECT = `${APP_SCHEME}://auth/callback`;

// The public website (purchases happen there — see store rules in README-mobile.md).
export const WEBSITE_URL = 'https://nothiapp.noahthirion67.workers.dev';

// ── Haptics ────────────────────────────────────────────────────────────────
let hapticsMod = null;
async function haptics() {
  if (!isNativePlatform) return null;
  if (!hapticsMod) hapticsMod = await import('@capacitor/haptics');
  return hapticsMod;
}
/** Light tap feedback (tab switches, toggles). Never throws. */
export async function tap(style = 'LIGHT') {
  try {
    const h = await haptics();
    if (h) await h.Haptics.impact({ style: h.ImpactStyle[style] ?? h.ImpactStyle.Light });
  } catch { /* no haptics on this device */ }
}
/** Success / warning / error notification feedback. Never throws. */
export async function notify(type = 'SUCCESS') {
  try {
    const h = await haptics();
    if (h) await h.Haptics.notification({ type: h.NotificationType[type] ?? h.NotificationType.Success });
  } catch { /* ignore */ }
}

// ── Opening things outside the WebView ─────────────────────────────────────
/**
 * Open a URL in the in-app browser (Custom Tabs / SFSafariViewController) on
 * native, or a new tab on the web. Use it for Stripe onboarding, file
 * downloads and any external page — the WebView must never navigate away.
 */
export async function openExternal(url, { onClose } = {}) {
  if (!isNativePlatform) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const { Browser } = await import('@capacitor/browser');
  if (onClose) {
    const handle = await Browser.addListener('browserFinished', () => {
      handle.remove();
      onClose();
    });
  }
  await Browser.open({ url, presentationStyle: 'popover', toolbarColor: '#0A0A0A' });
}

/** Download a purchased file: system browser on native (it owns downloads). */
export function downloadFile(url) {
  if (isNativePlatform) return openExternal(url);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return Promise.resolve();
}

// ── OAuth (Google / Discord) inside the app ────────────────────────────────
/**
 * Supabase returns to OAUTH_REDIRECT. Finish the sign-in from that URL:
 * PKCE (?code=...) or implicit (#access_token=...&refresh_token=...).
 */
export async function completeOAuthFromUrl(url, supabase) {
  if (!url || !url.startsWith(`${APP_SCHEME}://`)) return false;
  const parsed = new URL(url.replace(`${APP_SCHEME}://`, 'https://app.local/'));
  const code = parsed.searchParams.get('code');
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (hash.get('access_token') && hash.get('refresh_token')) {
    const { error } = await supabase.auth.setSession({
      access_token: hash.get('access_token'),
      refresh_token: hash.get('refresh_token'),
    });
    if (error) throw error;
  } else {
    const err = parsed.searchParams.get('error_description') || hash.get('error_description');
    if (err) throw new Error(err);
    return false;
  }
  try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* already closed */ }
  return true;
}

// ── App lifecycle: status bar, splash, back button, deep links ─────────────
let started = false;
/**
 * Call once, after the router exists.
 *  - router:   react-router data router (router.navigate / router.state)
 *  - supabase: the Supabase client (for OAuth deep links)
 */
export async function startNativeApp({ router, supabase }) {
  if (!isNativePlatform || started) return;
  started = true;

  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);

  // Status bar follows the app theme
  const syncStatusBar = () => {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    if (platform === 'android') {
      StatusBar.setBackgroundColor({ color: dark ? '#0A0A0A' : '#FFFFFF' }).catch(() => {});
    }
  };
  syncStatusBar();
  new MutationObserver(syncStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Android hardware back: go back inside the app; on a root tab, leave the app
  App.addListener('backButton', () => {
    const path = router.state.location.pathname;
    const roots = ['/', '/marketplace', '/library', '/dashboard/messages', '/me'];
    if (!roots.includes(path) && window.history.length > 1) router.navigate(-1);
    else App.minimizeApp();
  });

  // Deep links: OAuth return + nothi links opened from elsewhere
  App.addListener('appUrlOpen', async ({ url }) => {
    try {
      if (await completeOAuthFromUrl(url, supabase)) {
        router.navigate('/auth/callback', { replace: true });
        return;
      }
      const u = new URL(url);
      if (u.hostname.includes('nothi')) router.navigate(u.pathname + u.search);
    } catch (err) {
      console.error('[native] deep link failed:', err);
      router.navigate('/login?error=oauth', { replace: true });
    }
  });

  // Let the first screen paint, then fade the splash away
  setTimeout(() => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}), 150);
}
