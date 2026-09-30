import { lazy } from 'react';

/**
 * Route-level code splitting.
 * Each page is its own chunk, so the first screen only downloads what it
 * needs. Once the app is idle, every page chunk is fetched in the background
 * (preloadPages) so later navigations never wait on the network.
 */
const loaders = [];

export function lazyPage(load) {
  let promise;
  const once = () => (promise ??= load().catch((err) => {
    promise = undefined; // allow a retry (e.g. flaky network)
    // A new deploy removed the old chunk: reload once to get the new build
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(String(err?.message))
      && !sessionStorage.getItem('nothi-chunk-reload')) {
      sessionStorage.setItem('nothi-chunk-reload', '1');
      window.location.reload();
    }
    throw err;
  }));
  loaders.push(once);
  const Page = lazy(once);
  Page.preload = once;
  return Page;
}

export function preloadPages() {
  const run = () => {
    Promise.allSettled(loaders.map((l, i) => new Promise((r) => setTimeout(() => l().then(r, r), i * 40))))
      .then(() => { try { sessionStorage.removeItem('nothi-chunk-reload'); } catch { /* ignore */ } });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}
