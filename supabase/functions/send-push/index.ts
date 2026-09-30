// send-push — mobile push notifications for the Nothi app.
//
// Called by database triggers (migration 022) with ONLY { type, id }.
// verify_jwt is off because pg_net can't hold a user JWT; instead this function
// trusts nothing from the caller: it re-reads the row with the service role,
// only handles events created in the last 10 minutes, and pushes each event at
// most once (push_log). The worst a stranger can do is re-trigger a real,
// recent notification that has not been sent yet.
//
// Providers are optional — each one is skipped until its secrets exist:
//   Android (FCM v1): FCM_SERVICE_ACCOUNT = the Firebase service-account JSON
//   iOS (APNs):       APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID
//                     [APNS_BUNDLE_ID=app.nothi.mobile] [APNS_SANDBOX=true for dev builds]
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE_MS = 10 * 60 * 1000;

type Push = { userId: string; title: string; body: string; path: string };

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function fresh(ts: string | null) {
  return !!ts && Date.now() - new Date(ts).getTime() < MAX_AGE_MS;
}
function money(cents: number | null, fallback: number | null, currency = 'EUR') {
  const v = cents != null ? cents / 100 : Number(fallback || 0);
  try { return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(v); } catch { return `${v.toFixed(2)} €`; }
}
function titleOf(t: unknown): string {
  if (!t) return 'your product';
  if (typeof t === 'string') { try { const o = JSON.parse(t); if (o && typeof o === 'object') return titleOf(o); } catch { return t; } return t; }
  const o = t as Record<string, string>;
  return o.en || o.fr || Object.values(o)[0] || 'your product';
}

async function buildSale(db: ReturnType<typeof admin>, id: string): Promise<Push | null> {
  const { data: p } = await db.from('purchases')
    .select('seller_id, product_id, status, is_free, purchased_at, seller_amount_cents, price_paid, currency')
    .eq('id', id).maybeSingle();
  if (!p || p.status !== 'completed' || p.is_free || !fresh(p.purchased_at)) return null;
  const { data: prod } = await db.from('products').select('title').eq('id', p.product_id).maybeSingle();
  return {
    userId: p.seller_id,
    title: 'New sale 🎉',
    body: `${titleOf(prod?.title)} · you earn ${money(p.seller_amount_cents, p.price_paid, (p.currency || 'EUR').toUpperCase())}`,
    path: '/dashboard',
  };
}

async function buildMessage(db: ReturnType<typeof admin>, id: string): Promise<Push | null> {
  const { data: m } = await db.from('messages')
    .select('sender_id, receiver_id, content, attachment_url, created_at').eq('id', id).maybeSingle();
  if (!m || !m.receiver_id || m.receiver_id === m.sender_id || !fresh(m.created_at)) return null;
  const { data: sender } = await db.from('profiles').select('username').eq('id', m.sender_id).maybeSingle();
  const text = (m.content || '').trim();
  return {
    userId: m.receiver_id,
    title: sender?.username ? `@${sender.username}` : 'New message',
    body: text ? (text.length > 140 ? text.slice(0, 137) + '…' : text) : (m.attachment_url ? 'Sent you an attachment' : 'Sent you a message'),
    path: '/dashboard/messages',
  };
}

// ── FCM (Android) ─────────────────────────────────────────────────────────
let fcmCache: { token: string; exp: number; project: string } | null = null;
async function fcmAuth() {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) return null;
  if (fcmCache && fcmCache.exp > Date.now() + 60_000) return fcmCache;
  const sa = JSON.parse(raw);
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email).setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt().setExpirationTime('1h').sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`fcm auth ${res.status}`);
  fcmCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000, project: sa.project_id };
  return fcmCache;
}
async function sendFcm(token: string, p: Push): Promise<'ok' | 'gone' | 'skip' | 'error'> {
  const auth = await fcmAuth();
  if (!auth) return 'skip';
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.project}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: p.title, body: p.body },
        data: { path: p.path },
        android: { priority: 'high', notification: { sound: 'default', channel_id: 'default' } },
      },
    }),
  });
  if (res.ok) return 'ok';
  const txt = await res.text();
  return res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*registration/i.test(txt) ? 'gone' : 'error';
}

// ── APNs (iOS) ────────────────────────────────────────────────────────────
let apnsCache: { jwt: string; at: number } | null = null;
async function apnsJwt() {
  const p8 = Deno.env.get('APNS_KEY_P8'), kid = Deno.env.get('APNS_KEY_ID'), iss = Deno.env.get('APNS_TEAM_ID');
  if (!p8 || !kid || !iss) return null;
  if (apnsCache && Date.now() - apnsCache.at < 40 * 60 * 1000) return apnsCache.jwt;
  const key = await importPKCS8(p8.replace(/\\n/g, '\n'), 'ES256');
  const jwt = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid }).setIssuer(iss).setIssuedAt().sign(key);
  apnsCache = { jwt, at: Date.now() };
  return jwt;
}
async function sendApns(token: string, p: Push): Promise<'ok' | 'gone' | 'skip' | 'error'> {
  const jwt = await apnsJwt();
  if (!jwt) return 'skip';
  const host = Deno.env.get('APNS_SANDBOX') === 'true' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': Deno.env.get('APNS_BUNDLE_ID') || 'app.nothi.mobile',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: 'default' }, path: p.path }),
  });
  if (res.ok) return 'ok';
  const txt = await res.text();
  return res.status === 410 || /BadDeviceToken|Unregistered/.test(txt) ? 'gone' : 'error';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const { type, id } = await req.json().catch(() => ({}));
    if (!['sale', 'message'].includes(type) || !UUID.test(String(id))) return json({ error: 'bad request' }, 400);

    const db = admin();
    const push = type === 'sale' ? await buildSale(db, id) : await buildMessage(db, id);
    if (!push) return json({ skipped: 'not_eligible' });

    // At most once per event
    const { error: dup } = await db.from('push_log').insert({ event_key: `${type}:${id}` });
    if (dup) return json({ skipped: 'already_sent' });

    const { data: devices } = await db.from('device_tokens').select('token, platform').eq('user_id', push.userId);
    const results: Record<string, number> = {};
    for (const d of devices || []) {
      let r: string;
      try { r = d.platform === 'ios' ? await sendApns(d.token, push) : await sendFcm(d.token, push); }
      catch (e) { console.error('push', d.platform, (e as Error).message); r = 'error'; }
      results[r] = (results[r] || 0) + 1;
      if (r === 'gone') await db.from('device_tokens').delete().eq('token', d.token);
    }
    return json({ sent: results, devices: devices?.length || 0 });
  } catch (e) {
    console.error('send-push', e);
    return json({ error: 'internal' }, 500);
  }
});
