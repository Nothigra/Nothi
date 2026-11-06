import { useEffect, useState } from 'react';
import { invokeFunction } from './supabase';

// Chat attachments live in a private bucket. A message stores a
// 'nothi-private:<key>' reference; the real link is a short-lived signed URL
// that only the two people in the conversation can get.
const PREFIX = 'nothi-private:';
const cache = new Map(); // ref -> { url, at } | Promise
const TTL = 50 * 60 * 1000; // links are valid 60 min, refresh a bit before

export const isPrivateAttachment = (url) => typeof url === 'string' && url.startsWith(PREFIX);

export async function resolveAttachmentUrl(url) {
  if (!isPrivateAttachment(url)) return url;
  const hit = cache.get(url);
  if (hit && !(hit instanceof Promise) && Date.now() - hit.at < TTL) return hit.url;
  if (hit instanceof Promise) return hit;
  const p = invokeFunction('generate-download-url', { attachment: url })
    .then((d) => {
      cache.set(url, { url: d.downloadUrl, at: Date.now() });
      return d.downloadUrl;
    })
    .catch((e) => {
      cache.delete(url);
      throw e;
    });
  cache.set(url, p);
  return p;
}

/** Usable src for an attachment (null while the private link is being made). */
export function useAttachmentUrl(url) {
  const [src, setSrc] = useState(() => (isPrivateAttachment(url) ? null : url));
  useEffect(() => {
    let alive = true;
    if (!isPrivateAttachment(url)) { setSrc(url); return undefined; }
    resolveAttachmentUrl(url).then((u) => { if (alive) setSrc(u); }).catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [url]);
  return src;
}

/** Open an attachment (resolves private links first). */
export async function openAttachment(url, open = (u) => window.open(u, '_blank', 'noopener')) {
  const u = await resolveAttachmentUrl(url);
  if (u) open(u);
}
