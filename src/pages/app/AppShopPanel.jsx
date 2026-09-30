import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowUpRight, BarChart3, ChevronRight, Eye, Package, Pencil, Plus, Rocket, Share2, ShoppingBag, Trash2,
  Wallet, ExternalLink, Crown, TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { supabase, withTimeoutSafety } from '../../lib/supabase';
import { getMyProducts } from '../../api/productApi';
import { getSellerEarnings } from '../../api/billingApi';
import { isPro } from '../../config/plans';
import { getThumbnailUrl } from '../../utils/mediaHelpers';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { tap, notify, shareLink } from '../../lib/native';
import BoostModal from '../../components/dashboard/BoostModal';
import AppSheet from './AppSheet';

const isSaleActive = (p) => p.sale_price != null && Number(p.sale_price) >= 0.5 && Number(p.sale_price) < Number(p.price)
  && (!p.sale_ends_at || new Date(p.sale_ends_at) > new Date());
const isBoosted = (p) => p.boosted_until && new Date(p.boosted_until) > new Date();

function ago(iso) {
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  if (m < 2880) return 'Yesterday';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The seller's shop at a glance: money, numbers, latest sales and products with quick actions. */
export default function AppShopPanel() {
  const { profile, isMockMode, updateProfile } = useAuth();
  const { formatPrice } = useCurrency();
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const navigate = useNavigate();
  const pro = isPro(profile);

  const [products, setProducts] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [sales, setSales] = useState(null);
  const [menu, setMenu] = useState(null);
  const [boostProduct, setBoostProduct] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    const load = isMockMode
      ? Promise.resolve([profile.products || [], { grossCents: 0, netCents: 0, pendingCents: profile.balance || 0, transferredCents: 0, paidSales: 0 }, []])
      : Promise.all([
      getMyProducts(profile.id),
      getSellerEarnings(profile.id).catch(() => null),
      withTimeoutSafety(() => supabase.from('purchases')
        .select('id, purchased_at, price_paid, is_free, seller_amount_cents, product:products(title), buyer:public_profiles!buyer_id(username, avatar_url)')
        .eq('seller_id', profile.id).eq('status', 'completed')
        .order('purchased_at', { ascending: false }).limit(5)).then((r) => r.data || []).catch(() => []),
      ]);
    load.then(([prods, earn, recent]) => {
      if (!alive) return;
      setProducts(prods);
      setEarnings(earn);
      setSales(recent);
    });
    return () => { alive = false; };
  }, [profile?.id, isMockMode, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (p) => {
    setConfirmDelete(null);
    tap('MEDIUM');
    if (isMockMode) {
      await updateProfile({ products: (profile.products || []).filter((x) => x.id !== p.id) });
    } else {
      const { error } = await withTimeoutSafety(() => supabase.from('products').delete().eq('id', p.id));
      if (error) { notify('ERROR'); return; }
    }
    setProducts((list) => list.filter((x) => x.id !== p.id));
    notify('SUCCESS');
  };

  if (products === null) {
    return <div className="app-list-skeleton"><div className="app-skel-card" /><div className="app-skel-row" /><div className="app-skel-row" /></div>;
  }

  if (products.length === 0) {
    return (
      <div className="app-empty-card shop">
        <span className="app-empty-icon"><Package size={26} /></span>
        <h3>Open your shop</h3>
        <p>Sell your presets, LUTs, transitions and project files to thousands of editors — or share them for free.</p>
        <Link to="/publish" className="app-pill-btn primary" onClick={() => tap('MEDIUM')}><Plus size={18} /> Publish your first product</Link>
      </div>
    );
  }

  const totalViews = products.reduce((s, p) => s + (p.views || 0), 0);
  const totalSales = Math.max(profile?.sales_count || 0, products.reduce((s, p) => s + (p.sales_count || 0), 0));
  const net = earnings ? earnings.netCents / 100 : null;
  const pending = earnings ? earnings.pendingCents / 100 : null;
  const sellsPaid = products.some((p) => Number(p.price) > 0);
  const title = (p) => getLocalizedString(p.title, lang) || 'Untitled';

  return (
    <div className="app-shop">
      {sellsPaid && !profile?.stripe_account_id && !isMockMode && (
        <Link to="/dashboard/payouts" className="app-banner" onClick={() => tap()}>
          <Wallet size={20} />
          <span><b>Set up payouts</b><small>Connect your bank to receive the money from your sales.</small></span>
          <ChevronRight size={18} />
        </Link>
      )}

      {/* earnings */}
      <Link to="/dashboard/payouts" className="app-earn-card" onClick={() => tap()}>
        <span className="app-earn-label">Total earned <ArrowUpRight size={15} /></span>
        <span className="app-earn-amount">{net === null ? '—' : formatPrice(net)}</span>
        <span className="app-earn-sub">
          {pending ? <><span className="app-dot" /> {formatPrice(pending)} on its way to your bank</> : 'Everything has been paid out'}
        </span>
      </Link>

      <div className="app-stats">
        <div className="app-stat"><ShoppingBag size={17} /><b>{totalSales}</b><span>Sales</span></div>
        <div className="app-stat"><Eye size={17} /><b>{totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews}</b><span>Views</span></div>
        <div className="app-stat"><TrendingUp size={17} /><b>{totalViews ? `${((totalSales / totalViews) * 100).toFixed(1)}%` : '—'}</b><span>Conversion</span></div>
      </div>

      {/* recent sales */}
      <section className="app-group">
        <div className="app-group-head">
          <h3 className="app-group-title">Latest sales</h3>
          <Link to="/dashboard/analytics" className="app-text-btn" onClick={() => tap()}>Analytics</Link>
        </div>
        {sales && sales.length > 0 ? (
          <div className="app-group-card">
            {sales.map((s) => (
              <div key={s.id} className="app-sale-row">
                <span className="app-sale-avatar">{s.buyer?.avatar_url ? <img src={s.buyer.avatar_url} alt="" /> : (s.buyer?.username || '?').charAt(0).toUpperCase()}</span>
                <span className="app-result-meta">
                  <span className="app-result-title">{getLocalizedString(s.product?.title, lang) || 'Deleted product'}</span>
                  <span className="app-result-sub">{s.buyer?.username ? `@${s.buyer.username}` : 'A buyer'} · {ago(s.purchased_at)}</span>
                </span>
                <span className={`app-sale-amount ${s.is_free ? 'free' : ''}`}>
                  {s.is_free ? 'Free' : `+${formatPrice((s.seller_amount_cents ?? Math.round(Number(s.price_paid) * 100)) / 100)}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="app-quiet">No sales yet. Share your products to get the first one.</div>
        )}
      </section>

      {/* products */}
      <section className="app-group">
        <div className="app-group-head">
          <h3 className="app-group-title">My products · {products.length}</h3>
          <Link to="/publish" className="app-text-btn" onClick={() => tap()}><Plus size={14} /> New</Link>
        </div>
        <div className="app-group-card">
          {products.map((p) => {
            const thumb = getThumbnailUrl(p);
            const sale = isSaleActive(p);
            return (
              <button key={p.id} type="button" className="app-prod-row" onClick={() => { tap(); setMenu(p); }}>
                <span className="app-result-thumb">{thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" /> : <Package size={18} />}</span>
                <span className="app-result-meta">
                  <span className="app-result-title">{title(p)}</span>
                  <span className="app-result-sub">
                    {Number(p.price) === 0 ? 'Free' : formatPrice(sale ? p.sale_price : p.price)}
                    {sale && <s> {formatPrice(p.price)}</s>}
                    {' · '}{p.sales_count || 0} {Number(p.price) === 0 ? 'downloads' : 'sales'}
                  </span>
                </span>
                {p.status === 'draft' && <span className="app-tag">Draft</span>}
                {isBoosted(p) && <span className="app-tag hot"><Rocket size={11} /> Boost</span>}
                <ChevronRight size={18} className="app-row-chev" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-group">
        <div className="app-group-card">
          <Link to="/dashboard/analytics" className="app-row" onClick={() => tap()}><span className="app-row-icon"><BarChart3 size={18} /></span><span className="app-row-label">Analytics</span><ChevronRight size={18} className="app-row-chev" /></Link>
          <Link to="/dashboard/payouts" className="app-row" onClick={() => tap()}><span className="app-row-icon"><Wallet size={18} /></span><span className="app-row-label">Earnings & payouts</span><ChevronRight size={18} className="app-row-chev" /></Link>
          <Link to="/dashboard/subscription" className="app-row" onClick={() => tap()}><span className="app-row-icon"><Crown size={18} /></span><span className="app-row-label">Plan</span><span className="app-row-hint">{pro ? 'Pro' : 'Free'}</span><ChevronRight size={18} className="app-row-chev" /></Link>
        </div>
      </section>

      {/* product actions */}
      <AppSheet open={!!menu} onClose={() => setMenu(null)} title={menu ? title(menu) : ''}>
        {menu && (
          <>
            <button type="button" className="app-sheet-row" onClick={() => { setMenu(null); navigate(`/product/${menu.id}`); }}><ExternalLink size={19} /> View</button>
            <button type="button" className="app-sheet-row" onClick={() => { setMenu(null); navigate('/publish?edit=1', { state: { product: menu } }); }}><Pencil size={19} /> Edit</button>
            {!isMockMode && (
              <button type="button" className="app-sheet-row" onClick={() => { setMenu(null); shareLink({ title: title(menu), text: `${title(menu)} on Nothi`, path: `/product/${menu.id}` }); }}><Share2 size={19} /> Share</button>
            )}
            {pro && !isBoosted(menu) && (
              <button type="button" className="app-sheet-row" onClick={() => { const p = menu; setMenu(null); setBoostProduct(p); }}><Rocket size={19} /> Boost</button>
            )}
            <button type="button" className="app-sheet-row danger" onClick={() => { const p = menu; setMenu(null); setConfirmDelete(p); }}><Trash2 size={19} /> Delete</button>
          </>
        )}
      </AppSheet>

      <AppSheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={confirmDelete ? `Delete “${title(confirmDelete)}”?` : ''}>
        {confirmDelete && (
          <>
            <p className="app-sheet-text">It disappears from the marketplace. People who already have it keep their download.</p>
            <button type="button" className="app-sheet-row danger strong" onClick={() => remove(confirmDelete)}><Trash2 size={19} /> Delete product</button>
          </>
        )}
      </AppSheet>

      {boostProduct && (
        <BoostModal
          isOpen
          product={boostProduct}
          onClose={() => setBoostProduct(null)}
          onBoost={() => {}}
          onBoosted={() => { setBoostProduct(null); setReload((k) => k + 1); notify('SUCCESS'); }}
        />
      )}
    </div>
  );
}
