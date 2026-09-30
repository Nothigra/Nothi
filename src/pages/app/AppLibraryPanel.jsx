import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Download, Loader2, MessageCircle, MoreHorizontal, Package, ShoppingBag, Star, X, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getUserPurchases, requestDownloadUrl } from '../../api/productApi';
import { getThumbnailUrl } from '../../utils/mediaHelpers';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { downloadFile, tap, notify } from '../../lib/native';
import AppSheet from './AppSheet';

const cacheKeyFor = (id) => `nothi-library-${id}`;
function readCache(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function writeCache(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* full / private */ } }

function ago(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'Today';
  if (d < 2) return 'Yesterday';
  if (d < 30) return `${Math.floor(d)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The buyer's library: every asset they own, one tap to download. Works offline from the last copy. */
export default function AppLibraryPanel() {
  const { profile, isMockMode } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const navigate = useNavigate();
  const key = profile?.id && !isMockMode ? cacheKeyFor(profile.id) : null;

  const [items, setItems] = useState(() => (key ? readCache(key) : null));
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    getUserPurchases(profile.id, isMockMode).then((list) => {
      if (!alive) return;
      if (list) { setItems(list); if (key) writeCache(key, list); }
      else setItems((cur) => cur || []);
    });
    return () => { alive = false; };
  }, [profile?.id, isMockMode, key]);

  const download = async (p) => {
    tap();
    if (!p.product?.id) return;
    setDownloading(p.id);
    setError('');
    try {
      const { downloadUrl } = await requestDownloadUrl(p.product.id);
      await downloadFile(downloadUrl);
      notify('SUCCESS');
    } catch (err) {
      setError(err?.error === 'no_file'
        ? "The creator hasn't uploaded the file yet — send them a message."
        : (err?.message || 'Download failed. Check your connection and try again.'));
      notify('ERROR');
    } finally {
      setDownloading(null);
    }
  };

  const contact = (p) => navigate('/dashboard/messages', {
    state: { startNewChat: true, sellerId: p.seller_id, productId: p.product?.id, productTitle: getLocalizedString(p.product?.title, lang) },
  });

  if (items === null) {
    return <div className="app-list-skeleton">{[0, 1, 2].map((i) => <div key={i} className="app-skel-row" />)}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="app-empty-card">
        <span className="app-empty-icon"><ShoppingBag size={26} /></span>
        <h3>Your library is empty</h3>
        <p>Assets you get on Nothi — free or bought on the website — show up here, ready to download.</p>
        <Link to="/marketplace" className="app-pill-btn" onClick={() => tap()}>Browse assets</Link>
      </div>
    );
  }

  return (
    <div className="app-lib">
      {error && (
        <div className="app-inline-error" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      <div className="app-group-card">
        {items.map((p) => {
          const prod = p.product;
          const thumb = prod ? getThumbnailUrl(prod) : null;
          const title = prod ? getLocalizedString(prod.title, lang) : 'No longer available';
          return (
            <div key={p.id} className="app-lib-row">
              <button type="button" className="app-lib-main" disabled={!prod} onClick={() => { tap(); navigate(`/product/${prod.id}`); }}>
                <span className="app-result-thumb">{thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" /> : <Package size={18} />}</span>
                <span className="app-result-meta">
                  <span className="app-result-title">{title}</span>
                  <span className="app-result-sub">{p.seller?.username ? `@${p.seller.username} · ` : ''}{ago(p.purchased_at)}{p.is_free ? ' · Free' : ''}</span>
                </span>
              </button>
              {prod && (
                <>
                  <button type="button" className="app-round-btn primary" aria-label="Download" disabled={downloading === p.id} onClick={() => download(p)}>
                    {downloading === p.id ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
                  </button>
                  <button type="button" className="app-round-btn" aria-label="More" onClick={() => { tap(); setMenu(p); }}>
                    <MoreHorizontal size={18} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <AppSheet open={!!menu} onClose={() => setMenu(null)} title={menu?.product ? getLocalizedString(menu.product.title, lang) : ''}>
        {menu && (
          <>
            <button type="button" className="app-sheet-row" onClick={() => { setMenu(null); navigate(`/product/${menu.product.id}`); }}><ExternalLink size={19} /> View product</button>
            <button type="button" className="app-sheet-row" onClick={() => { setMenu(null); navigate(`/product/${menu.product.id}`); }}><Star size={19} /> Leave a review</button>
            {menu.seller_id && menu.seller_id !== profile?.id && (
              <button type="button" className="app-sheet-row" onClick={() => { setMenu(null); contact(menu); }}><MessageCircle size={19} /> Message the creator</button>
            )}
          </>
        )}
      </AppSheet>
    </div>
  );
}
