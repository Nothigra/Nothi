import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, X, Clock, ArrowUpRight, Package, Sparkles, FolderArchive, Contrast, Volume2, ArrowRightLeft, LayoutTemplate, TerminalSquare, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPublicProducts, peekPublicProducts } from '../../api/productApi';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { CATEGORIES } from '../../lib/seed';
import { getThumbnailUrl } from '../../utils/mediaHelpers';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { tap } from '../../lib/native';
import './AppPages.css';

const ICONS = { Package, Sparkles, FolderArchive, Contrast, Volume2, ArrowRightLeft, LayoutTemplate, TerminalSquare, Layers };
const RECENT_KEY = 'nothi-recent-searches';

function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function saveRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* private mode */ }
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** App search: keyboard opens immediately, recent searches, instant results as you type. */
export default function AppSearchPage() {
  const { isMockMode } = useAuth();
  const { formatPrice } = useCurrency();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [recent, setRecent] = useState(readRecent);
  const [products, setProducts] = useState(() => peekPublicProducts(isMockMode) || []);

  useEffect(() => {
    let alive = true;
    getPublicProducts(isMockMode).then((d) => { if (alive && d) setProducts(d); });
    return () => { alive = false; };
  }, [isMockMode]);

  // Focus after the push animation has started (iOS only opens the keyboard on a focus it trusts)
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  // Pre-normalised search index
  const index = useMemo(() => products.map((p) => {
    const title = getLocalizedString(p.title, lang);
    const tags = p.tags ? Object.values(p.tags).flat() : [];
    return {
      p,
      title,
      hay: norm([title, getLocalizedString(p.description, lang), p.category, p.creator_username, ...(p.software || []), ...tags].join(' ')),
    };
  }), [products, lang]);

  const results = useMemo(() => {
    const words = norm(deferred).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index
      .filter((r) => words.every((w) => r.hay.includes(w)))
      .sort((a, b) => (norm(b.title).startsWith(words[0]) ? 1 : 0) - (norm(a.title).startsWith(words[0]) ? 1 : 0))
      .slice(0, 30);
  }, [deferred, index]);

  const remember = (term) => {
    const v = term.trim();
    if (!v) return;
    const next = [v, ...recent.filter((r) => r.toLowerCase() !== v.toLowerCase())];
    setRecent(next);
    saveRecent(next);
  };
  const seeAll = (term) => {
    remember(term);
    navigate(`/marketplace?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <div className="app-page app-search-page">
      <form
        className="app-search-field"
        role="search"
        onSubmit={(e) => { e.preventDefault(); inputRef.current?.blur(); if (query.trim()) seeAll(query); }}
      >
        <Search size={18} />
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search presets, LUTs, SFX…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        {query && (
          <button type="button" className="app-search-clear" aria-label="Clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
            <X size={16} />
          </button>
        )}
      </form>

      {!query.trim() ? (
        <>
          {recent.length > 0 && (
            <section className="app-group">
              <div className="app-group-head">
                <p className="app-group-title">Recent</p>
                <button type="button" className="app-text-btn" onClick={() => { setRecent([]); saveRecent([]); }}>Clear</button>
              </div>
              <div className="app-group-card">
                {recent.map((r) => (
                  <button key={r} type="button" className="app-row" onClick={() => { tap(); setQuery(r); }}>
                    <span className="app-row-icon"><Clock size={17} /></span>
                    <span className="app-row-label">{r}</span>
                    <ArrowUpRight size={17} className="app-row-chev" />
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="app-group">
            <p className="app-group-title">Browse categories</p>
            <div className="app-cat-grid">
              {CATEGORIES.map((c) => {
                const Icon = ICONS[c.icon] || Package;
                return (
                  <Link key={c.id} to={`/marketplace?category=${c.id}`} className="app-cat-tile" onClick={() => tap()}>
                    <Icon size={20} />
                    <span>{t(`categories.${c.id}`, { defaultValue: c.name })}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      ) : results.length === 0 ? (
        <div className="app-empty">
          <Search size={28} />
          <p>No results for “{query.trim()}”.<br />Try another word or browse a category.</p>
        </div>
      ) : (
        <section className="app-group">
          <div className="app-group-card">
            {results.map(({ p, title }) => {
              const thumb = getThumbnailUrl(p);
              const sale = p.sale_price ?? p.salePrice;
              const price = Number(p.price) === 0 ? 'Free' : formatPrice(sale ?? p.price);
              return (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  state={{ product: p }}
                  className="app-result"
                  onClick={() => { tap(); remember(query); }}
                >
                  <span className="app-result-thumb">
                    {thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" /> : <Package size={18} />}
                  </span>
                  <span className="app-result-meta">
                    <span className="app-result-title">{title}</span>
                    <span className="app-result-sub">{p.creator_username ? `@${p.creator_username} · ` : ''}{t(`categories.${p.category}`, { defaultValue: p.category })}</span>
                  </span>
                  <span className="app-result-price">{price}</span>
                </Link>
              );
            })}
          </div>
          <button type="button" className="app-see-all" onClick={() => seeAll(query)}>
            See all results with filters
          </button>
        </section>
      )}
    </div>
  );
}
