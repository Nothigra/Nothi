import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { MessageCircle, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useChat, openConversation } from '../../lib/chatStore';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { tap } from '../../lib/native';
import './AppPages.css';
import './AppChat.css';

function when(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const previewText = (m) => {
  if (!m) return '';
  if (m === '[Image]') return '📷 Photo';
  if (m.startsWith('[File] ')) return `📎 ${m.slice(7)}`;
  return m;
};

/** Messages tab: every conversation, newest first. */
export default function AppConversationsPage() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { conversations, loaded } = useChat();
  const [q, setQ] = useState('');

  // Coming from "Message the creator" (product page, library…): open that chat
  useEffect(() => {
    const st = location.state;
    if (!st || !user) return;
    if (st.startNewChat && st.sellerId) {
      const id = openConversation({
        partnerId: st.sellerId, partner: { username: st.sellerName || 'Creator' },
        productId: st.productId, productTitle: st.productTitle, productSellerId: st.sellerId,
      });
      if (id) navigate(`/messages/${encodeURIComponent(id)}`, { replace: true });
    } else if (st.activeChatId) {
      navigate(`/messages/${encodeURIComponent(st.activeChatId)}`, { replace: true });
    }
  }, [location.state, user, navigate]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return conversations;
    return conversations.filter((c) => [c.partner?.username, getLocalizedString(c.productTitle, lang), c.lastMessage]
      .some((v) => String(v || '').toLowerCase().includes(t)));
  }, [conversations, q, lang]);

  if (!loaded) {
    return <div className="app-page"><div className="app-list-skeleton">{[0, 1, 2, 3].map((i) => <div key={i} className="app-skel-row" />)}</div></div>;
  }

  return (
    <div className="app-page chat-list-page">
      {conversations.length > 3 && (
        <label className="app-search-field chat-search">
          <Search size={17} />
          <input type="search" placeholder="Search messages" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button type="button" className="app-search-clear" aria-label="Clear" onClick={() => setQ('')}><X size={15} /></button>}
        </label>
      )}

      {conversations.length === 0 ? (
        <div className="app-empty-card">
          <span className="app-empty-icon"><MessageCircle size={26} /></span>
          <h3>No messages yet</h3>
          <p>Questions about a product you own, or from your buyers, land here. You'll get a notification for each new message.</p>
        </div>
      ) : list.length === 0 ? (
        <p className="app-quiet">No conversation matches “{q}”.</p>
      ) : (
        <div className="chat-list">
          {list.map((c) => {
            const name = c.partner?.username || 'Nothi user';
            return (
              <button
                key={c.id}
                type="button"
                className={`chat-row ${c.unread ? 'unread' : ''}`}
                onClick={() => { tap(); navigate(`/messages/${encodeURIComponent(c.id)}`); }}
              >
                <span className="chat-avatar">
                  {c.partner?.avatar_url ? <img src={c.partner.avatar_url} alt="" /> : name.charAt(0).toUpperCase()}
                </span>
                <span className="chat-row-main">
                  <span className="chat-row-top">
                    <span className="chat-row-name">{name}</span>
                    {c.iAmSeller && <span className="chat-role">Buyer</span>}
                    <span className="chat-row-time">{when(c.updatedAt)}</span>
                  </span>
                  <span className="chat-row-product">{getLocalizedString(c.productTitle, lang)}</span>
                  <span className="chat-row-bottom">
                    <span className="chat-row-preview">{previewText(c.lastMessage) || 'New conversation'}</span>
                    {c.unread > 0 && <span className="chat-unread">{c.unread > 9 ? '9+' : c.unread}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
