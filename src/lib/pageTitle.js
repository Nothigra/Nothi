import { useEffect } from 'react';
import { useLocation } from 'react-router';

// Browser-tab titles per page ("Marketplace · Nothi"). Pages with their own
// subject (a product, a creator) call usePageTitle() with it.
const BASE = 'Nothi';
const DEFAULT = 'Nothi — Marketplace for Video Editors';
const TITLES = [
  [/^\/$/, DEFAULT],
  [/^\/marketplace/, 'Marketplace'],
  [/^\/best-sellers/, 'Top creators'],
  [/^\/pricing/, 'Pricing'],
  [/^\/rewards/, 'Rewards'],
  [/^\/contact/, 'Contact'],
  [/^\/about/, 'About'],
  [/^\/terms/, 'Terms of Service'],
  [/^\/privacy/, 'Privacy Policy'],
  [/^\/downloads/, 'My downloads'],
  [/^\/login/, 'Sign in'],
  [/^\/onboarding/, 'Welcome'],
  [/^\/notifications/, 'Notifications'],
  [/^\/checkout\/success/, 'Thank you'],
  [/^\/dashboard\/upload/, 'Publish a product'],
  [/^\/dashboard\/products/, 'My products'],
  [/^\/dashboard\/messages/, 'Messages'],
  [/^\/dashboard\/payouts/, 'Payouts'],
  [/^\/dashboard\/analytics/, 'Analytics'],
  [/^\/dashboard\/settings/, 'Settings'],
  [/^\/dashboard\/badges/, 'Badges'],
  [/^\/dashboard/, 'Dashboard'],
];

let override = null;

function apply(pathname) {
  if (override) { document.title = `${override} · ${BASE}`; return; }
  const hit = TITLES.find(([re]) => re.test(pathname));
  if (!hit) { document.title = DEFAULT; return; }
  document.title = hit[1] === DEFAULT ? DEFAULT : `${hit[1]} · ${BASE}`;
}

/** Mounted once in the app root. */
export function useRouteTitles() {
  const { pathname } = useLocation();
  useEffect(() => { apply(pathname); }, [pathname]);
}

/** A page's own title (e.g. the product name), while it is shown. */
export function usePageTitle(title) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!title) return undefined;
    override = title;
    apply(pathname);
    return () => { override = null; apply(window.location.pathname); };
  }, [title, pathname]);
}
