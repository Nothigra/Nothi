import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { m as motion, AnimatePresence } from 'framer-motion';
import Words from '../ui/Words';
import { Search, SlidersHorizontal } from 'lucide-react';
import TrustBar from './TestimonialsSection';
import { useTranslation } from 'react-i18next';
import { useUnifiedSearch } from '../../hooks/useUnifiedSearch';
import SearchDropdown from '../common/SearchDropdown';
import { useAuth } from '../../context/AuthContext';
import './Hero.css';

const searchTerms = [
  "hero.searchPresets",
  "hero.searchTransitions",
  "hero.searchOverlays",
  "hero.searchProjectFiles"
];

/* ─────────────── Animated Search ─────────────── */
function AnimatedSearch() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const baseLang = i18n.language.split('-')[0];
  const { results: searchResults, debouncedQuery, isSearching: searchPending } = useUnifiedSearch(query, baseLang);

  useEffect(() => {
    if (query || isFocused) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % searchTerms.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [query, isFocused]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query) {
      navigate(`/marketplace?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className={`hero-search-wrapper ${isFocused ? 'focused' : ''}`}>
      <form className="hero-search-form" onSubmit={handleSubmit}>
        <div className="search-icon-wrapper">
          <Search size={20} className={isFocused ? 'icon-focused' : ''} />
        </div>
        
        <input 
          type="text" 
          className="hero-search-input" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
        />

        {!query && !isFocused && (
          <div className="hero-search-placeholder">
            <AnimatePresence mode="wait">
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="placeholder-text"
              >
                {t(searchTerms[index])}
              </motion.span>
            </AnimatePresence>
          </div>
        )}

        <button type="button" className="search-filter-btn" aria-label="Filter" onClick={() => navigate('/marketplace')}>
          <SlidersHorizontal size={18} />
        </button>
      </form>
      
      <SearchDropdown 
        query={query}
        debouncedQuery={debouncedQuery}
        results={searchResults}
        isSearching={searchPending}
        isVisible={isFocused}
        onClose={() => setIsFocused(false)}
      />
    </div>
  );
}

/* ─────────────── Hero Component ─────────────── */
export default function Hero() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="hero-section">
      <div className="hero-inner">
        <div className="hero-head">
          <span className="nl-eyebrow" data-reveal>Nothi · for editors</span>
          <h1 className="hero-headline nl-words">
            <span className="hl-1"><Words text="The marketplace" /></span>
            <span className="hl-2 nl-light"><Words text="for editors." start={2} /></span>
          </h1>
        </div>
        <div className="hero-side" data-reveal style={{ '--d': '.25s' }}>
          <p className="hero-subheadline">Presets, LUTs, transitions and project files, made and sold by editors.</p>
          <AnimatedSearch />
          <div className="hero-ctas">
            <Link to="/marketplace" className="btn btn-primary btn-lg btn-pill">
              Browse the marketplace
            </Link>
            <Link to={isAuthenticated ? '/dashboard/upload' : '/login'} className="btn btn-outline btn-lg btn-pill">
              Start selling
            </Link>
          </div>
        </div>
      </div>

      <div className="hero-software-banner-wrapper" data-reveal style={{ '--d': '.45s' }}>
        <TrustBar />
      </div>
    </section>
  );
}
