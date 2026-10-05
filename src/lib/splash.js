/**
 * The app's launch screen lives in index.html (logo, tagline, three dots) so it
 * is visible before any script loads. This removes it once the first screen is
 * ready — never before the entrance animation had time to play, never later
 * than a safety limit.
 */
const MIN_VISIBLE = 1300;  // ms: the entrance reads as intended, not as a flash
const MAX_VISIBLE = 7000;  // ms: whatever happens, the app shows

let done = false;
function remove() {
  if (done) return;
  done = true;
  const el = document.getElementById('nothi-splash');
  if (!el) return;
  el.classList.add('out');
  setTimeout(() => { el.remove(); document.documentElement.classList.remove('app-boot'); }, 520);
}

export function hideSplash() {
  if (done) return;
  const shown = Date.now() - (window.__nothiSplashStart || Date.now());
  setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(remove)), Math.max(0, MIN_VISIBLE - shown));
}

if (typeof window !== 'undefined' && window.__nothiSplashStart) setTimeout(remove, MAX_VISIBLE);
