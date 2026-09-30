import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, BellRing, Download, MessageCircle, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { supabase, withTimeoutSafety } from '../../lib/supabase';
import { useChat } from '../../lib/chatStore';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { tap, pushSupported, enablePush } from '../../lib/native';
import './AppPages.css';
import './AppChat.css';

function ago(iso) {
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 1) return 'now';
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  if (m < 10080) return `${Math.round(m / 1440)} d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Notifications, app version: real activity — sales, messages, new assets in your library. */
export default function AppActivityPage() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const { profile, isMockMode } = useAuth();
  const { formatPrice } = useCurrency();
  const { conversations } = useChat();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    const load = isMockMode ? Promise.resolve([[], []]) : Promise.all([
      withTimeoutSafety(() => supabase.from('purchases')
        .select('id, purchased_at, is_free, price_paid, seller_amount_cents, product:products(title), buyer:public_profiles!buyer_id(username, avatar_url)')
        .eq('seller_id', profile.id).eq('status', 'completed').order('purchased_at', { ascending: false }).limit(20))
        .then((r) => r.data || []).catch(() => []),
      withTimeoutSafety(() => supabase.from('purchases')
        .select('id, purchased_at, is_free, product_id, product:public_products!product_id(title)')
        .eq('buyer_id', profile.id).eq('status', 'completed').order('purchased_at', { ascending: false }).limit(10))
        .then((r) => r.data || []).catch(() => []),
    ]);
    load.then(([sold, bought]) => {
      if (!alive) return;
      setRows([
        ...sold.map((s) => ({
          key: 's' + s.id, at: s.purchased_at, icon: s.is_free ? Download : ShoppingBag, tone: s.is_free ? '' : 'money',
          title: s.is_free ? 'New download' : 'New sale',
          text: `${s.buyer?.username ? '@' + s.buyer.username : 'Someone'} ${s.is_free ? 'got' : 'bought'} “${getLocalizedString(s.product?.title, lang) || 'your product'}”`,
          amount: s.is_free ? null : `+${formatPrice((s.seller_amount_cents ?? Math.round(Number(s.price_paid) * 100)) / 100)}`,
          to: '/me',
        })),
        ...bought.map((b) => ({
          key: 'b' + b.id, at: b.purchased_at, icon: Download, tone: '',
          title: 'Added to your library', text: getLocalizedString(b.product?.title, lang) || 'A new asset', to: '/library',
        })),
      ]);
    });
    return () => { alive = false; };
  }, [profile?.id, isMockMode, lang, formatPrice]);

  const items = useMemo(() => {
    const msgs = conversations
      .filter((c) => c.messages.length && !c.messages[c.messages.length - 1].mine)
      .map((c) => ({
        key: 'm' + c.id, at: c.updatedAt, icon: MessageCircle, tone: c.unread ? 'unread' : '',
        title: c.partner?.username || 'New message', text: c.lastMessage === '[Image]' ? '📷 Photo' : c.lastMessage,
        to: `/messages/${encodeURIComponent(c.id)}`, unread: c.unread > 0,
      }));
    const all = [...msgs, ...(rows || [])].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);
    const weekAgo = Date.now() - 7 * 86400000;
    return { all, recent: all.filter((i) => new Date(i.at).getTime() >= weekAgo), older: all.filter((i) => new Date(i.at).getTime() < weekAgo) };
  }, [conversations, rows]);
  const { recent, older } = items;

  const Row = (it) => {
    const Icon = it.icon;
    return (
      <button key={it.key} type="button" className={`act-row ${it.unread ? 'unread' : ''}`} onClick={() => { tap(); navigate(it.to); }}>
        <span className={`act-icon ${it.tone}`}><Icon size={18} /></span>
        <span className="app-result-meta">
          <span className="app-result-title">{it.title}</span>
          <span className="act-text">{it.text}</span>
        </span>
        <span className="act-side">
          <span className="act-time">{ago(it.at)}</span>
          {it.amount && <span className="app-sale-amount">{it.amount}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="app-page">
      {pushSupported && (
        <button type="button" className="app-banner calm" onClick={() => { tap(); enablePush(supabase); }}>
          <BellRing size={20} />
          <span><b>Push notifications</b><small>Get notified instantly of sales and messages. Tap to allow.</small></span>
        </button>
      )}
      {rows === null && !isMockMode ? (
        <div className="app-list-skeleton">{[0, 1, 2].map((i) => <div key={i} className="app-skel-row" />)}</div>
      ) : items.all.length === 0 ? (
        <div className="app-empty-card">
          <span className="app-empty-icon"><Bell size={26} /></span>
          <h3>All quiet for now</h3>
          <p>Sales, messages and new assets in your library will show up here.</p>
        </div>
      ) : (
        <>
          {recent.length > 0 && <section className="app-group"><h3 className="app-group-title">This week</h3><div className="app-group-card">{recent.map(Row)}</div></section>}
          {older.length > 0 && <section className="app-group"><h3 className="app-group-title">Earlier</h3><div className="app-group-card">{older.map(Row)}</div></section>}
        </>
      )}
    </div>
  );
}
