import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Package, Sparkles, FolderArchive, Contrast, Volume2, ArrowRightLeft, LayoutTemplate, TerminalSquare, Layers, ChevronRight } from 'lucide-react';
import { getPublicProducts } from '../../api/productApi';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES } from '../../lib/seed';
import ProductCard from '../../components/product/ProductCard';
import { tap } from '../../lib/native';
import './AppPages.css';

const ICONS = { Package, Sparkles, FolderArchive, Contrast, Volume2, ArrowRightLeft, LayoutTemplate, TerminalSquare, Layers };

function Rail({ title, to, products }) {
  if (!products.length) return null;
  return (
    <section className="app-rail">
      <div className="app-rail-head">
        <h2>{title}</h2>
        {to && <Link to={to} className="app-rail-more" onClick={() => tap()}>See all <ChevronRight size={16} /></Link>}
      </div>
      <div className="app-rail-track">
        {products.map((p) => (
          <div className="app-rail-item" key={p.id}><ProductCard product={p} /></div>
        ))}
      </div>
    </section>
  );
}

export default function AppDiscoverPage() {
  const { profile, isMockMode } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);

  useEffect(() => {
    let alive = true;
    getPublicProducts(isMockMode).then((data) => { if (alive) setProducts(data || []); });
    return () => { alive = false; };
  }, [isMockMode]);

  const { trending, fresh, onSale, creators } = useMemo(() => {
    const list = products || [];
    const byRank = [...list].sort((a, b) => (a.popular_rank ?? 9e9) - (b.popular_rank ?? 9e9) || (b.sales_count || 0) - (a.sales_count || 0));
    const byDate = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const sale = list.filter((p) => (p.sale_price ?? p.salePrice) != null);
    const seen = new Map();
    for (const p of byRank) {
      const name = p.creator_username || p.creatorName;
      if (name && !seen.has(name)) seen.set(name, { name, avatar: p.creator_avatar, pro: p.creator_is_pro });
    }
    return { trending: byRank.slice(0, 10), fresh: byDate.slice(0, 10), onSale: sale.slice(0, 10), creators: [...seen.values()].slice(0, 12) };
  }, [products]);

  return (
    <div className="app-page">
      <p className="app-greeting">
        {profile?.username ? <>Hey <b>{profile.username}</b>, what are you editing today?</> : 'Assets for video editors, by video editors.'}
      </p>

      <button type="button" className="app-search" onClick={() => { tap(); navigate('/marketplace'); }}>
        <Search size={18} /> <span>Search presets, LUTs, SFX…</span>
      </button>

      <div className="app-chips" role="list">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c.icon] || Package;
          return (
            <Link key={c.id} role="listitem" to={`/marketplace?category=${c.id}`} className="app-chip" onClick={() => tap()}>
              <Icon size={16} /> {c.name}
            </Link>
          );
        })}
      </div>

      {products === null ? (
        <div className="app-rail">
          <div className="app-rail-head"><h2>Trending now</h2></div>
          <div className="app-rail-track">{[0, 1, 2].map((k) => <div key={k} className="app-rail-item app-skeleton" />)}</div>
        </div>
      ) : products.length === 0 ? (
        <div className="app-empty">
          <Package size={32} />
          <p>No products yet. Be the first creator on Nothi.</p>
          <Link to="/dashboard/upload" className="btn btn-primary">Publish a product</Link>
        </div>
      ) : (
        <>
          <Rail title="Trending now" to="/marketplace" products={trending} />
          {onSale.length > 0 && <Rail title="On sale" to="/marketplace" products={onSale} />}
          <Rail title="New arrivals" to="/marketplace" products={fresh} />
          {creators.length > 0 && (
            <section className="app-rail">
              <div className="app-rail-head"><h2>Creators</h2></div>
              <div className="app-rail-track creators">
                {creators.map((c) => (
                  <Link key={c.name} to={`/creator/${c.name}`} className="app-creator" onClick={() => tap()}>
                    <span className="app-creator-avatar">
                      {c.avatar ? <img src={c.avatar} alt="" /> : c.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="app-creator-name">{c.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
