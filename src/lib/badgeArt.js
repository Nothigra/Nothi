// Nothi badges and grades — flat, minimal artwork (no 3D, no glow).
//
// Badges: 20 enamel-pin style marks, one silhouette per family, colour by
// rarity (outline colour + fill colour). Grades: the ring around a profile
// picture, earned with XP levels.
//
// Everything is plain SVG markup built from constants (no user input), so it
// is safe to render with dangerouslySetInnerHTML.

const f = (n) => +n.toFixed(2);

const starPath = (cx, cy, r, inner = 0.45, n = 5, rot = -90) => {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 ? r * inner : r;
    p.push(`${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`);
  }
  return `M${p.join('L')}Z`;
};

const scallop = (cx, cy, r, bumps, depth) => {
  let d = '';
  const steps = bumps * 8;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rr = r - depth + depth * Math.cos(t * bumps);
    d += `${i ? 'L' : 'M'}${f(cx + rr * Math.cos(t - Math.PI / 2))} ${f(cy + rr * Math.sin(t - Math.PI / 2))}`;
  }
  return `${d}Z`;
};

const num = (s, y, size) =>
  `<text x="32" y="${y}" text-anchor="middle" font-size="${size}" font-weight="800" fill="var(--pin-metal)" stroke="none" font-family="Inter Tight, Inter, system-ui, sans-serif" letter-spacing="-.4">${s}</text>`;
const solid = (d) => `<path d="${d}" fill="var(--pin-metal)" stroke="none"/>`;

// One silhouette per family + where the glyph sits inside it
export const SHAPES = {
  coin: { d: 'M32 4a28 28 0 1 1 0 56a28 28 0 1 1 0-56z', inner: 'M32 10.5a21.5 21.5 0 1 1 0 43a21.5 21.5 0 1 1 0-43z', c: [32, 32], k: 0.72 },
  tag: { d: 'M15 8h22.5l19.5 19.5v24.5a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z', hole: [44, 20, 3.2], c: [29.5, 35], k: 0.62 },
  shield: { d: 'M32 4.5l23 7.5v18.5c0 14-10.5 23.5-23 29c-12.5-5.5-23-15-23-29V12z', c: [32, 30.5], k: 0.68 },
  rosette: { d: scallop(32, 32, 29, 14, 2.2), inner: 'M32 11a21 21 0 1 1 0 42a21 21 0 1 1 0-42z', c: [32, 32], k: 0.66 },
  flame: { d: 'M32 60c-13.2 0-21-8.7-21-18.8 0-12 10.3-16.2 12-31.2 9 5.7 13.4 13.4 13.4 21 2.8-2.8 4.2-6.2 4.2-10.4 6.2 6 12.4 13.4 12.4 21 0 10-7.8 18.4-21 18.4z', c: [32, 41], k: 0.62 },
  chevron: { d: 'M11 6h42v34L32 58 11 40z', c: [32, 28.5], k: 0.68 },
  crest: { d: starPath(32, 32, 29.5, 0.82, 12, -90), inner: 'M32 12a20 20 0 1 1 0 40a20 20 0 1 1 0-40z', c: [32, 32], k: 0.64 },
  diamond: { d: 'M32 3.5l28.5 28.5L32 60.5 3.5 32z', c: [32, 32], k: 0.64 },
};

// Glyphs on a 64 box: strokes and fills in the outline colour (var(--pin-metal))
const GLYPHS = {
  first_sale: '<path d="M37.5 24.5a9.5 9.5 0 1 0 0 15"/><path d="M22.5 29.5h12M22.5 34.5h12"/>',
  half_century: num('50', 40, 21),
  century_seller: `${solid('M24.5 17l3 3.6L32 14l4.5 6.6 3-3.6-1.2 6H25.7z')}${num('100', 43, 17)}`,
  first_purchase: '<path d="M19 25h26l-2.2 21.6a3 3 0 0 1-3 2.7H24.2a3 3 0 0 1-3-2.7z"/><path d="M25.5 27v-4.5a6.5 6.5 0 0 1 13 0V27"/>',
  collector: `<rect x="21" y="18" width="18" height="25" rx="2.5" transform="rotate(-14 30 43)"/><rect x="25" y="18" width="18" height="25" rx="2.5" transform="rotate(10 34 43)" fill="var(--pin-fill)"/>${solid(starPath(34, 30, 5))}`,
  prolific_creator: '<path d="M32 17l17 8.5-17 8.5-17-8.5z"/><path d="M15 33.5l17 8.5 17-8.5"/><path d="M15 41.5l17 8.5 17-8.5"/>',
  master_creator: `${solid('M23 12l4.5 5L32 9.5l4.5 7.5 4.5-5-1.6 9.5H24.6z')}<path d="M32 26l17 8.5-17 8.5-17-8.5z"/><path d="M15 42l17 8.5 17-8.5"/>`,
  one_week: `<rect x="17" y="19" width="30" height="27" rx="4"/><path d="M17 27h30M24.5 15v7M39.5 15v7"/>${num('7', 42.5, 13)}`,
  one_month: `<rect x="17" y="19" width="30" height="27" rx="4"/><path d="M17 27h30M24.5 15v7M39.5 15v7"/>${num('30', 42.5, 12)}`,
  six_months: `<path d="M21 14h22M21 50h22"/><path d="M24 14c0 9 8 11.5 8 18s-8 9-8 18M40 14c0 9-8 11.5-8 18s8 9 8 18"/>${solid('M27 47c2.5-3.5 7.5-3.5 10 0z')}`,
  // the Nothi capybara, as a mask filled with the outline colour
  one_year: '<rect x="13" y="19" width="38" height="29" fill="var(--pin-metal)" stroke="none" mask="url(#capy-mask)"/>',
  week_streak: solid('M32 46c-5.6 0-9.5-4-9.5-9.5 0-6.3 6.2-9.5 8-16 4.7 3.2 11 8 11 16 0 5.4-3.9 9.5-9.5 9.5z'),
  month_streak: solid('M35.5 19l-10 15.5h7.5l-3.5 12.5 12-17h-8l4-11z'),
  level_10: `${solid(starPath(32, 17, 6))}<path d="M19 37l13-8.5L45 37"/>`,
  level_20: `${solid(starPath(32, 14, 6))}<path d="M19 33l13-8.5L45 33M19 42l13-8.5L45 42"/>`,
  level_30: `${solid(starPath(32, 12, 5.5))}<path d="M19 29l13-8.5L45 29M19 37.5l13-8.5 13 8.5M19 46l13-8.5L45 46"/>`,
  top_50: num('50', 39.5, 18),
  top_10: '<path d="M23.5 17h17v8.5a8.5 8.5 0 0 1-17 0z"/><path d="M23.5 20h-4.5a5 5 0 0 0 5.5 8M40.5 20H45a5 5 0 0 1-5.5 8"/><path d="M32 34v6M26 46h12"/>',
  number_one: `<path d="M17 41l-2.5-17 9.5 7.5L32 18l8 13.5 9.5-7.5L47 41z"/><path d="M17 46h30"/>${num('1', 38.5, 11)}`,
  boosted: '<path d="M32 13c6.5 5 9 12 9 19l-3 6.5H26l-3-6.5c0-7 2.5-14 9-19z"/><circle cx="32" cy="27" r="3.2"/><path d="M23.5 33.5l-5 4.5.8 6.5 5.7-3M40.5 33.5l5 4.5-.8 6.5-5.7-3M29.5 43c0 3 1.1 5.2 2.5 7 1.4-1.8 2.5-4 2.5-7"/>',
};

// Rarity = outline colour + fill colour (flat)
export const RARITIES = {
  common: { order: 0, label: 'Common', metal: '#9aa0a7', fill: '#2a2d32', swatch: '#9aa0a7' },
  uncommon: { order: 1, label: 'Uncommon', metal: '#e4e7ea', fill: '#1b7a4e', swatch: '#1f8a59' },
  rare: { order: 2, label: 'Rare', metal: '#e4e7ea', fill: '#1f4db0', swatch: '#2656c4' },
  epic: { order: 3, label: 'Epic', metal: '#efc565', fill: '#52259a', swatch: '#6a35c2' },
  legendary: { order: 4, label: 'Legendary', metal: '#efc565', fill: '#93212a', swatch: '#b0303a' },
  mythic: { order: 5, label: 'Mythic', metal: 'url(#pin-iris)', fill: '#16131f', swatch: 'linear-gradient(90deg,#7ad8ff,#b18cff,#ff8fcf,#ffd27a)' },
};

// Catalogue. English is the default text; translations live in locales
// under badges.<id>.title / badges.<id>.desc.
export const BADGES = [
  { id: 'first_purchase', shape: 'tag', rarity: 'common', type: 'purchases', title: 'First Purchase', desc: 'Buy your first product', goal: 1, unit: 'purchase' },
  { id: 'one_week', shape: 'rosette', rarity: 'common', type: 'tenure', title: 'Welcome', desc: '7 days on Nothi', goal: 7, unit: 'days' },
  { id: 'first_sale', shape: 'coin', rarity: 'common', type: 'sales', title: 'First Sale', desc: 'Make your first sale', goal: 1, unit: 'sale' },
  { id: 'one_month', shape: 'rosette', rarity: 'uncommon', type: 'tenure', title: 'Regular', desc: '30 days on Nothi', goal: 30, unit: 'days' },
  { id: 'week_streak', shape: 'flame', rarity: 'uncommon', type: 'streak', title: 'On Fire', desc: '7-day reward streak', goal: 7, unit: 'days' },
  { id: 'boosted', shape: 'diamond', rarity: 'uncommon', type: 'special', title: 'Spotlight', desc: 'Boost a product', goal: 1, unit: 'boost' },
  { id: 'level_10', shape: 'chevron', rarity: 'uncommon', type: 'level', title: 'Rising Star', desc: 'Reach level 10', goal: 10, unit: 'level' },
  { id: 'collector', shape: 'tag', rarity: 'rare', type: 'purchases', title: 'Collector', desc: 'Buy from 10 different creators', goal: 10, unit: 'creators' },
  { id: 'prolific_creator', shape: 'shield', rarity: 'rare', type: 'products', title: 'Prolific Creator', desc: 'Publish 10 products', goal: 10, unit: 'products' },
  { id: 'six_months', shape: 'rosette', rarity: 'rare', type: 'tenure', title: 'Veteran', desc: '6 months on Nothi', goal: 180, unit: 'days' },
  { id: 'top_50', shape: 'crest', rarity: 'rare', type: 'leaderboard', title: 'Top 50', desc: 'Reach the top 50 sellers', goal: 0, unit: '' },
  { id: 'half_century', shape: 'coin', rarity: 'epic', type: 'sales', title: 'Half Century', desc: 'Reach 50 sales', goal: 50, unit: 'sales' },
  { id: 'month_streak', shape: 'flame', rarity: 'epic', type: 'streak', title: 'Unstoppable', desc: '30-day reward streak', goal: 30, unit: 'days' },
  { id: 'level_20', shape: 'chevron', rarity: 'epic', type: 'level', title: 'Elite', desc: 'Reach level 18', goal: 18, unit: 'level' },
  { id: 'top_10', shape: 'crest', rarity: 'epic', type: 'leaderboard', title: 'Top 10', desc: 'Reach the top 10 sellers', goal: 0, unit: '' },
  { id: 'century_seller', shape: 'coin', rarity: 'legendary', type: 'sales', title: 'Century Club', desc: 'Reach 100 sales', goal: 100, unit: 'sales' },
  { id: 'master_creator', shape: 'shield', rarity: 'legendary', type: 'products', title: 'Master Creator', desc: 'Publish 50 products', goal: 50, unit: 'products' },
  { id: 'level_30', shape: 'chevron', rarity: 'legendary', type: 'level', title: 'Legend', desc: 'Reach level 24', goal: 24, unit: 'level' },
  { id: 'one_year', shape: 'rosette', rarity: 'legendary', type: 'tenure', title: 'Founding Member', desc: '1 year on Nothi', goal: 365, unit: 'days' },
  { id: 'number_one', shape: 'crest', rarity: 'mythic', type: 'leaderboard', title: 'Number One', desc: 'Become the #1 seller', goal: 0, unit: '' },
].map((b, i) => ({ ...b, no: i + 1 }));

export const badgeById = (id) => BADGES.find((b) => b.id === id) || null;

let seq = 0;

/** SVG markup of one badge. */
export function badgeSVG(badgeOrId, { locked = false } = {}) {
  const b = typeof badgeOrId === 'string' ? badgeById(badgeOrId) : badgeOrId;
  if (!b) return '';
  const sh = SHAPES[b.shape];
  const r = RARITIES[b.rarity];
  const id = `p${++seq}`;
  const metal = locked ? '#55585f' : r.metal.replace('#pin-iris', `#${id}i`);
  const fill = locked ? '#1c1d21' : r.fill;
  const [cx, cy] = sh.c;
  const sw = f((3.4 / sh.k) * 0.62);
  const glyph = (GLYPHS[b.id] || '')
    .replace('url(#capy-mask)', `url(#${id}m)`)
    .replaceAll('var(--pin-metal)', metal)
    .replaceAll('var(--pin-fill)', fill);
  return `<svg viewBox="0 0 64 64" class="nb-pin" aria-hidden="true" focusable="false">
<defs>${b.rarity === 'mythic' && !locked ? `<linearGradient id="${id}i" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ad8ff"/><stop offset=".33" stop-color="#b18cff"/><stop offset=".66" stop-color="#ff8fcf"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>` : ''}${b.id === 'one_year' ? `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><image href="/logo-mark.png" x="13" y="19" width="38" height="29"/></mask>` : ''}</defs>
<path d="${sh.d}" fill="${fill}" stroke="${metal}" stroke-width="3.4" stroke-linejoin="round"/>
${sh.inner ? `<path d="${sh.inner}" fill="none" stroke="${metal}" stroke-width="1.3" opacity=".7"/>` : ''}
${sh.hole ? `<circle cx="${sh.hole[0]}" cy="${sh.hole[1]}" r="${sh.hole[2]}" style="fill:var(--color-bg, #0a0a0b)" stroke="${metal}" stroke-width="1.6"/>` : ''}
<g transform="translate(${cx} ${cy}) scale(${sh.k}) translate(-32 -32)" stroke="${metal}" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`;
}

// ── Grades (ring around the profile picture) ────────────────────────────────
export const GRADES = [
  { id: 'rookie', label: 'Rookie', level: 1, color: '#6b7078', ticks: 0, band: 2 },
  { id: 'bronze', label: 'Bronze', level: 4, color: '#c07a43', ticks: 0, band: 4 },
  { id: 'silver', label: 'Silver', level: 8, color: '#c9ced4', ticks: 4, band: 4 },
  { id: 'gold', label: 'Gold', level: 13, color: '#e2b04a', ticks: 8, band: 5 },
  { id: 'platinum', label: 'Platinum', level: 18, color: '#b9d3e8', ticks: 12, band: 5 },
  { id: 'diamond', label: 'Diamond', level: 24, color: 'iris', ticks: 12, band: 6, marks: true },
];

/** Same formula as add_xp_and_level_up() in the database. */
export const xpForLevel = (lvl) => Math.ceil(500 * (Math.pow(1.3, Math.max(1, lvl) - 1) - 1));
export const gradeFor = (level = 1) => GRADES.reduce((g, x) => ((level || 1) >= x.level ? x : g), GRADES[0]);
export const nextGrade = (level = 1) => GRADES.find((g) => g.level > (level || 1)) || null;

/** 0..1 progress from the current level to the next one. */
export function levelProgress(xp = 0, level = 1) {
  const a = xpForLevel(level);
  const b = xpForLevel(level + 1);
  return b > a ? Math.max(0, Math.min(1, (xp - a) / (b - a))) : 0;
}

/** SVG markup of the grade ring (drawn on a 120 box, photo sits inside r≈46). */
export function ringSVG(level = 1, progress = 0) {
  const g = gradeFor(level);
  const id = `r${++seq}`;
  const c = 60;
  const R = 55;
  const band = g.band;
  const stroke = g.color === 'iris' ? `url(#${id}g)` : g.color;
  const ticks = Array.from({ length: g.ticks }, (_, i) => {
    const a = (i / g.ticks) * Math.PI * 2 - Math.PI / 2;
    const r1 = R - band / 2;
    const r2 = R + band / 2;
    return `<line x1="${f(c + r1 * Math.cos(a))}" y1="${f(c + r1 * Math.sin(a))}" x2="${f(c + r2 * Math.cos(a))}" y2="${f(c + r2 * Math.sin(a))}" style="stroke:var(--color-bg, #0a0a0b)" stroke-width="1.2"/>`;
  }).join('');
  const marks = g.marks ? [-90, -60, -120].map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const x = c + R * Math.cos(a);
    const y = c + R * Math.sin(a);
    const s = i ? 3 : 4.2;
    return `<path d="M${f(x)} ${f(y - s)}L${f(x + s * 0.75)} ${f(y)}L${f(x)} ${f(y + s)}L${f(x - s * 0.75)} ${f(y)}Z" fill="#f4f8ff"/>`;
  }).join('') : '';
  const arcR = R - band / 2 - 2.6;
  const circ = 2 * Math.PI * arcR;
  const p = Math.max(0, Math.min(1, progress || 0));
  return `<svg viewBox="0 0 120 120" class="nb-ring" aria-hidden="true" focusable="false">
<defs>${g.color === 'iris' ? `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ad8ff"/><stop offset=".33" stop-color="#b18cff"/><stop offset=".66" stop-color="#ff8fcf"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>` : ''}</defs>
<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${stroke}" stroke-width="${band}"/>
${ticks}
${p > 0 ? `<circle cx="${c}" cy="${c}" r="${arcR}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="1.6"/><circle cx="${c}" cy="${c}" r="${arcR}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="${f(circ * p)} ${f(circ)}" transform="rotate(-90 ${c} ${c})"/>` : ''}
${marks}
</svg>`;
}
