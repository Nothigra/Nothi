// Social links for creator shops: platform list, URL detection and brand marks.
import {
  siTiktok, siYoutube, siInstagram, siX, siDiscord, siTwitch, siFacebook,
  siBehance, siVimeo, siPatreon, siSnapchat, siPinterest, siThreads,
  siKick, siSpotify, siSoundcloud, siArtstation, siDribbble, siBluesky, siLinktree,
} from 'simple-icons';

export const SOCIAL_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', icon: siTiktok, hosts: ['tiktok.com'] },
  { id: 'youtube', label: 'YouTube', icon: siYoutube, hosts: ['youtube.com', 'youtu.be'] },
  { id: 'instagram', label: 'Instagram', icon: siInstagram, hosts: ['instagram.com'] },
  { id: 'x', label: 'X (Twitter)', icon: siX, hosts: ['x.com', 'twitter.com'] },
  { id: 'discord', label: 'Discord', icon: siDiscord, hosts: ['discord.gg', 'discord.com'] },
  { id: 'twitch', label: 'Twitch', icon: siTwitch, hosts: ['twitch.tv'] },
  { id: 'kick', label: 'Kick', icon: siKick, hosts: ['kick.com'] },
  { id: 'threads', label: 'Threads', icon: siThreads, hosts: ['threads.net', 'threads.com'] },
  { id: 'bluesky', label: 'Bluesky', icon: siBluesky, hosts: ['bsky.app'] },
  { id: 'facebook', label: 'Facebook', icon: siFacebook, hosts: ['facebook.com', 'fb.com'] },
  { id: 'snapchat', label: 'Snapchat', icon: siSnapchat, hosts: ['snapchat.com'] },
  { id: 'pinterest', label: 'Pinterest', icon: siPinterest, hosts: ['pinterest.com', 'pin.it'] },
  { id: 'vimeo', label: 'Vimeo', icon: siVimeo, hosts: ['vimeo.com'] },
  { id: 'behance', label: 'Behance', icon: siBehance, hosts: ['behance.net'] },
  { id: 'artstation', label: 'ArtStation', icon: siArtstation, hosts: ['artstation.com'] },
  { id: 'dribbble', label: 'Dribbble', icon: siDribbble, hosts: ['dribbble.com'] },
  { id: 'patreon', label: 'Patreon', icon: siPatreon, hosts: ['patreon.com'] },
  { id: 'spotify', label: 'Spotify', icon: siSpotify, hosts: ['spotify.com'] },
  { id: 'soundcloud', label: 'SoundCloud', icon: siSoundcloud, hosts: ['soundcloud.com'] },
  { id: 'linktree', label: 'Linktree', icon: siLinktree, hosts: ['linktr.ee'] },
  { id: 'website', label: 'Website', icon: null, hosts: [] },
];

export const MAX_SOCIAL_LINKS = 8;

/** Adds https:// when missing; returns null for anything that isn't a web link. */
export function normalizeUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const hit = SOCIAL_PLATFORMS.find(p => p.hosts.some(h => host === h || host.endsWith(`.${h}`)));
    return hit ? hit.id : 'website';
  } catch {
    return 'website';
  }
}

export const platformById = (id) => SOCIAL_PLATFORMS.find(p => p.id === id) || SOCIAL_PLATFORMS[SOCIAL_PLATFORMS.length - 1];

/** Clean list for display: only valid web links, platform resolved, max 8. */
export function cleanLinks(links) {
  return (Array.isArray(links) ? links : [])
    .map(l => {
      const url = normalizeUrl(l?.url);
      if (!url) return null;
      const platform = l.platform && l.platform !== 'website' ? l.platform : detectPlatform(url);
      return { platform, url, title: l.title || platformById(platform).label };
    })
    .filter(Boolean)
    .slice(0, MAX_SOCIAL_LINKS);
}
