import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { createPortal } from 'react-dom';
import { ArrowUp, Check, CheckCheck, ChevronRight, FileText, Loader2, Lock, Paperclip, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useChat, markRead, sendText, sendAttachment, retryFailed, dropFailed } from '../../lib/chatStore';
import { checkHasPurchased } from '../../api/productApi';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { useScreenTitle } from '../../lib/screenTitle';
import { tap, notify, openExternal } from '../../lib/native';
import AppSheet from './AppSheet';
import './AppChat.css';

function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** One conversation, full screen: bubbles, composer on the keyboard, product on top. */
export default function AppChatPage() {
  const { id: rawId } = useParams();
  const id = decodeURIComponent(rawId || '');
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const { user, isMockMode } = useAuth();
  const { conversations, loaded } = useChat();
  const conv = conversations.find((c) => c.id === id);
  const name = conv?.partner?.username || '';
  useScreenTitle(`/messages/${rawId}`, name);

  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [failedMenu, setFailedMenu] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const stick = useRef(true); // follow new messages unless the user scrolled up

  // Buyers can message a creator once they own the product; creators can always answer
  const [owned, setOwned] = useState({}); // productId -> bool
  const freeToWrite = !conv || isMockMode || conv.iAmSeller || conv.messages.some((m) => !m.mine);
  useEffect(() => {
    if (freeToWrite || !user || !conv?.productId) return;
    let alive = true;
    checkHasPurchased(user.id, conv.productId, false).then((ok) => { if (alive) setOwned((o) => ({ ...o, [conv.productId]: !!ok })); });
    return () => { alive = false; };
  }, [freeToWrite, user, conv?.productId]); // eslint-disable-line react-hooks/exhaustive-deps
  const canWrite = freeToWrite || owned[conv?.productId] !== false;

  useEffect(() => { if (conv?.unread) markRead(conv); }, [conv]);

  // Keep the newest message in view
  const count = conv?.messages.length || 0;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count, id]);
  useEffect(() => {
    // the keyboard opening shrinks the screen: stay at the bottom
    const onResize = () => { const el = listRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight; };
    window.visualViewport?.addEventListener('resize', onResize);
    return () => window.visualViewport?.removeEventListener('resize', onResize);
  }, []);

  const groups = useMemo(() => {
    const out = [];
    let lastDay = '';
    (conv?.messages || []).forEach((m, i, arr) => {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) { out.push({ type: 'day', key: 'd' + day, label: dayLabel(m.createdAt) }); lastDay = day; }
      const next = arr[i + 1];
      const lastOfRun = !next || next.mine !== m.mine || new Date(next.createdAt) - new Date(m.createdAt) > 5 * 60000;
      out.push({ type: 'msg', key: m.id, m, lastOfRun });
    });
    return out;
  }, [conv?.messages]);
  const lastMineRead = useMemo(() => {
    const mine = (conv?.messages || []).filter((m) => m.mine && !m.pending && !m.failed);
    return mine.length ? mine[mine.length - 1] : null;
  }, [conv?.messages]);

  const autoGrow = (el) => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; };

  const send = async () => {
    if (!text.trim() || !conv) return;
    tap();
    const t = text;
    setText('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; inputRef.current.focus(); }
    stick.current = true;
    const ok = await sendText(conv, t);
    if (!ok) notify('ERROR');
  };

  const attach = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !conv) return;
    setError('');
    setUploading(true);
    stick.current = true;
    try { await sendAttachment(conv, f); }
    catch (err) { setError(err?.message || 'Upload failed.'); notify('ERROR'); }
    finally { setUploading(false); }
  };

  if (!conv) {
    return createPortal(
      <div className="chat-screen">
        <div className="chat-empty">{loaded ? 'This conversation is no longer available.' : <Loader2 className="spin" size={22} />}</div>
      </div>,
      document.body,
    );
  }

  // Portaled: a fixed full-height layout can't live inside the animated (transformed) screen
  return createPortal(
    <div className="chat-screen">
      {conv.productId && (
        <Link to={`/product/${conv.productId}`} className="chat-product" onClick={() => tap()}>
          <span className="chat-product-label">{conv.iAmSeller ? 'About your product' : 'About'}</span>
          <span className="chat-product-title">{getLocalizedString(conv.productTitle, lang)}</span>
          <ChevronRight size={16} />
        </Link>
      )}

      <div
        className="chat-scroll"
        ref={listRef}
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
      >
        {groups.length === 0 && (
          <div className="chat-intro">
            <span className="chat-avatar big">{conv.partner?.avatar_url ? <img src={conv.partner.avatar_url} alt="" /> : name.charAt(0).toUpperCase()}</span>
            <b>{name}</b>
            <p>{conv.iAmSeller ? 'Say hi to your buyer.' : 'Ask about installation, compatibility or anything else. Be kind — creators are people too.'}</p>
          </div>
        )}
        {groups.map((g) => g.type === 'day' ? (
          <div key={g.key} className="chat-day"><span>{g.label}</span></div>
        ) : (
          <Fragment key={g.key}>
            <div className={`bubble-row ${g.m.mine ? 'mine' : 'theirs'} ${g.lastOfRun ? 'tail' : ''}`}>
              <div
                className={`bubble ${g.m.attachmentType === 'image' ? 'media' : ''} ${g.m.failed ? 'failed' : ''} ${g.m.pending ? 'pending' : ''}`}
                onClick={() => { if (g.m.failed) { tap(); setFailedMenu(g.m); } }}
              >
                {g.m.attachmentType === 'image' && g.m.attachmentUrl && (
                  <img src={g.m.attachmentUrl} alt="" loading="lazy" onClick={() => openExternal(g.m.attachmentUrl)} />
                )}
                {g.m.attachmentType === 'file' && g.m.attachmentUrl && (
                  <button type="button" className="bubble-file" onClick={() => openExternal(g.m.attachmentUrl)}>
                    <FileText size={18} /> <span>{g.m.content.replace(/^\[File\] /, '') || 'File'}</span>
                  </button>
                )}
                {!(g.m.attachmentType === 'image' && g.m.content === '[Image]') && !(g.m.attachmentType === 'file' && g.m.content.startsWith('[File] ')) && (
                  <span className="bubble-text">{g.m.content}</span>
                )}
              </div>
            </div>
            {g.lastOfRun && (
              <div className={`bubble-meta ${g.m.mine ? 'mine' : ''}`}>
                {g.m.failed ? <span className="bubble-failed">Not sent · tap to retry</span> : (
                  <>
                    {time(g.m.createdAt)}
                    {g.m.mine && !g.m.pending && lastMineRead?.id === g.m.id && (g.m.read ? <> · <CheckCheck size={13} /> Seen</> : <> · <Check size={13} /></>)}
                    {g.m.pending && ' · Sending…'}
                  </>
                )}
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {canWrite ? (
        <div className="chat-composer">
          {error && <p className="chat-error">{error}</p>}
          <div className="chat-composer-row">
            <input ref={fileRef} type="file" className="hidden" onChange={attach} />
            <button type="button" className="chat-icon-btn" aria-label="Attach a file" disabled={uploading} onClick={() => { tap(); fileRef.current?.click(); }}>
              {uploading ? <Loader2 size={20} className="spin" /> : <Paperclip size={20} />}
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              className="chat-input"
              placeholder={`Message ${name}`}
              value={text}
              onChange={(e) => { setText(e.target.value); autoGrow(e.target); }}
              onFocus={() => { stick.current = true; }}
              enterKeyHint="send"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); send(); } }}
            />
            <button type="button" className={`chat-send ${text.trim() ? 'ready' : ''}`} aria-label="Send" disabled={!text.trim()} onMouseDown={(e) => e.preventDefault()} onClick={send}>
              <ArrowUp size={20} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-locked">
          <Lock size={18} />
          <span>You can message {name || 'the creator'} once you own this product.</span>
        </div>
      )}

      <AppSheet open={!!failedMenu} onClose={() => setFailedMenu(null)} title="Message not sent">
        {failedMenu && (
          <>
            <button type="button" className="app-sheet-row" onClick={() => { retryFailed(conv, failedMenu.id); setFailedMenu(null); }}><RotateCcw size={19} /> Try again</button>
            <button type="button" className="app-sheet-row danger" onClick={() => { dropFailed(failedMenu.id); setFailedMenu(null); }}><Trash2 size={19} /> Delete</button>
          </>
        )}
      </AppSheet>
    </div>,
    document.body,
  );
}
