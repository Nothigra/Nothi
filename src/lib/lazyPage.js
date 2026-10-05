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
  // One page at a time, and only while the phone has nothing else to do.
  // (They used to arrive every 40 ms right after launch — about two seconds of
  // parsing in the background, exactly while you start scrolling.)
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 300));
  let i = 0;
  const next = () => {
    if (i >= loaders.length) {
      try { sessionStorage.removeItem('nothi-chunk-reload'); } catch { /* ignore */ }
      return;
    }
    const load = loaders[i++];
    load().then(() => idle(next), () => idle(next));
  };
  setTimeout(() => idle(next), 3000);
}
