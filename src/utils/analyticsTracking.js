/**
 * Classifies the current visit's traffic source from document.referrer,
 * and its device type from viewport width. Used when logging a product
 * view so Analytics can show real source/device breakdowns.
 */

const SOCIAL_HOSTS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 't.co',
  'tiktok.com', 'linkedin.com', 'reddit.com', 'pinterest.com',
  'youtube.com', 'discord.com', 'threads.net',
];

const SEARCH_HOSTS = [
  'google.', 'bing.com', 'duckduckgo.com', 'yahoo.', 'baidu.com', 'ecosia.org',
];

export function detectTrafficSource() {
  if (typeof document === 'undefined' || !document.referrer) {
    return 'direct';
  }

  try {
    const referrerHost = new URL(document.referrer).hostname.replace(/^www\./, '');
    const currentHost = window.location.hostname.replace(/^www\./, '');

    if (referrerHost === currentHost) {
      return 'direct'; // internal navigation, not an external source
    }
    if (SOCIAL_HOSTS.some(h => referrerHost.includes(h))) {
      return 'social';
    }
    if (SEARCH_HOSTS.some(h => referrerHost.includes(h))) {
      return 'google';
    }
    return 'other';
  } catch {
    return 'direct';
  }
}

export function detectDeviceType() {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width <= 768) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}
