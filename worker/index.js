// Nothi — Cloudflare Worker in front of the static site.
//
// The site is a single-page app, so every page shares one index.html. Link
// previews (Discord, WhatsApp, TikTok, X…) and search engines don't run
// JavaScript: for the pages worth sharing, this worker fills in the real
// title, description and image before the HTML leaves Cloudflare.
// It also serves robots.txt and a sitemap built from the live catalogue.
// Everything else goes straight to the static files.

const DEFAULT_TITLE = 'Nothi — Marketplace for Video Editors';
const DEFAULT_DESC = 'Buy and sell presets, transitions, LUTs, SFX, project files and more for After Effects, Premiere Pro, DaVinci Resolve, CapCut and every editing app.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value, lang = 'en') {
  if (!value) return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('{')) { try { return text(JSON.parse(s), lang); } catch { return s; } }
    return s;
  }
  if (typeof value === 'object') return value[lang] || value.en || Object.values(value)[0] || '';
  return String(value);
}
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

async function rest(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    cf: { cacheTtl: 120, cacheEverything: true },
  });
  if (!res.ok) return null;
  return res.json();
}

function firstImage(p) {
  const media = Array.isArray(p.media) ? p.media : [];
  const img = media.find((m) => m && m.type !== 'video' && m.url) || null;
  return img?.url || (Array.isArray(p.images) && p.images[0]) || null;
}

class SetAttr {
  constructor(attr, value) { this.attr = attr; this.value = value; }
  element(el) { if (this.value) el.setAttribute(this.attr, this.value); }
}
class SetText {
  constructor(value) { this.value = value; }
  element(el) { if (this.value) el.setInnerContent(this.value); }
}
class AppendHead {
  constructor(html) { this.html = html; }
  element(el) { el.append(this.html, { html: true }); }
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function withMeta(env, request, url, meta) {
  const page = await env.ASSETS.fetch(new Request(new URL('/', url), request));
  const title = meta.title || DEFAULT_TITLE;
  const desc = meta.description || DEFAULT_DESC;
  const image = meta.image || `${url.origin}/og-image.jpg`;
  const canonical = `${url.origin}${url.pathname}`;
  const res = new HTMLRewriter()
    .on('title', new SetText(title))
    .on('meta[name="description"]', new SetAttr('content', desc))
    .on('meta[property="og:title"]', new SetAttr('content', title))
    .on('meta[property="og:description"]', new SetAttr('content', desc))
    .on('meta[property="og:type"]', new SetAttr('content', meta.type || 'website'))
    .on('head', new AppendHead(
      `<meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${esc(canonical)}">`
      + `<meta property="og:site_name" content="Nothi"><meta name="twitter:card" content="summary_large_image">`
      + `<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}">`
      + `<meta name="twitter:image" content="${esc(image)}"><link rel="canonical" href="${esc(canonical)}">`
      + (meta.noindex ? '<meta name="robots" content="noindex">' : ''),
    ))
    .transform(page);
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'public, max-age=60');
  return out;
}

async function productMeta(env, id) {
  const rows = await rest(env, `public_products?id=eq.${id}&select=id,title,description,images,media,effective_price,creator_username,category&limit=1`);
  const p = rows?.[0];
  if (!p) return { title: `Product not found · Nothi`, noindex: true };
  const price = Number(p.effective_price || 0);
  const priceText = price > 0 ? `€${price.toFixed(2)}` : 'Free';
  return {
    title: `${clip(text(p.title), 70)} · ${priceText} · Nothi`,
    description: clip(text(p.description) || `By @${p.creator_username} on Nothi.`, 180),
    image: firstImage(p),
    type: 'product',
  };
}

async function creatorMeta(env, username) {
  const rows = await rest(env, `public_profiles?username=ilike.${encodeURIComponent(username)}&select=username,bio,avatar_url,shop_settings&limit=1`);
  const c = rows?.[0];
  if (!c) return { title: 'Creator not found · Nothi', noindex: true };
  return {
    title: `@${c.username} · Nothi`,
    description: clip(text(c.bio) || `Presets, LUTs and editing assets by @${c.username} on Nothi.`, 180),
    image: c.shop_settings?.banner_url || c.avatar_url || null,
    type: 'profile',
  };
}

async function sitemap(env, origin) {
  const rows = (await rest(env, 'public_products?select=id,updated_at&order=updated_at.desc&limit=5000')) || [];
  const people = (await rest(env, 'public_products?select=creator_username&limit=5000')) || [];
  const creators = [...new Set(people.map((r) => r.creator_username).filter(Boolean))];
  const urls = ['/', '/marketplace', '/best-sellers', '/pricing', '/about']
    .map((p) => `<url><loc>${origin}${p}</loc></url>`)
    .concat(rows.map((r) => `<url><loc>${origin}/product/${r.id}</loc>${r.updated_at ? `<lastmod>${r.updated_at.slice(0, 10)}</lastmod>` : ''}</url>`))
    .concat(creators.map((u) => `<url><loc>${origin}/creator/${encodeURIComponent(u)}</loc></url>`));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

function robots(origin) {
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /checkout\nDisallow: /auth\nDisallow: /login\nDisallow: /onboarding\n\nSitemap: ${origin}/sitemap.xml\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/robots.txt') return robots(url.origin);
      if (path === '/sitemap.xml') return await sitemap(env, url.origin);
      const prod = path.match(/^\/product\/([^/]+)\/?$/);
      if (prod && UUID.test(prod[1])) return await withMeta(env, request, url, await productMeta(env, prod[1]));
      const creator = path.match(/^\/creator\/([A-Za-z0-9._-]{1,40})\/?$/);
      if (creator) return await withMeta(env, request, url, await creatorMeta(env, creator[1]));
      if (path === '/' || path === '/marketplace') return await withMeta(env, request, url, {});
    } catch (err) {
      console.error('meta worker', err);
    }
    return env.ASSETS.fetch(request);
  },
};
