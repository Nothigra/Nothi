import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Star } from 'lucide-react';
import SoftwareBanner from './SoftwareBanner';
import { useTranslation } from 'react-i18next';
import { useUnifiedSearch } from '../../hooks/useUnifiedSearch';
import SearchDropdown from '../common/SearchDropdown';
import { SOFTWARE_LIST } from '../../lib/seed';
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
  const { results: searchResults, debouncedQuery } = useUnifiedSearch(query, baseLang);

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
        isVisible={isFocused}
        onClose={() => setIsFocused(false)}
      />
    </div>
  );
}

/* ─────────────── Mouse Light Effect ─────────────── */
function MouseLight() {
  const lightRef = useRef(null);
  const rafRef = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const visible = useRef(false);

  const loop = useCallback(function loopFn() {
    current.current.x += (target.current.x - current.current.x) * 0.06;
    current.current.y += (target.current.y - current.current.y) * 0.06;

    if (lightRef.current) {
      lightRef.current.style.transform =
        `translate3d(${current.current.x - 350}px, ${current.current.y - 350}px, 0)`;
      lightRef.current.style.opacity = visible.current ? '1' : '0';
    }
    rafRef.current = requestAnimationFrame(loopFn);
  }, []);

  useEffect(() => {
    const hero = document.querySelector('.hero-section');
    if (!hero) return;

    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      target.current.x = e.clientX - rect.left;
      target.current.y = e.clientY - rect.top;
    };
    const onEnter = () => { visible.current = true; };
    const onLeave = () => { visible.current = false; };

    hero.addEventListener('mousemove', onMove, { passive: true });
    hero.addEventListener('mouseenter', onEnter);
    hero.addEventListener('mouseleave', onLeave);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      hero.removeEventListener('mousemove', onMove);
      hero.removeEventListener('mouseenter', onEnter);
      hero.removeEventListener('mouseleave', onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  return <div ref={lightRef} className="hero-mouse-light" style={{ opacity: 0 }} />;
}

/* ─────────────── Social Proof ─────────────── */
function SocialProof() {
  return (
    <div className="hero-social-proof">
      <div className="social-avatars">
        {['#3B3B3B', '#565656', '#717171', '#8C8C8C', '#A6A6A6'].map((color, i) => (
          <div
            key={i}
            className="social-avatar"
            style={{ background: color, zIndex: 5 - i }}
          >
            <span>{String.fromCharCode(65 + i)}</span>
          </div>
        ))}
      </div>
      <div className="social-info">
        <div className="social-stars">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={14} fill="currentColor" />
          ))}
          <span className="social-rating">4.9/5</span>
        </div>
        <span className="social-text">Loved by editors worldwide</span>
      </div>
    </div>
  );
}

/* ─────────────── Typewriter Animation ─────────────── */
const typewriterContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02,
      delayChildren: 0.1
    }
  }
};

const typewriterLetter = {
  hidden: { opacity: 0, y: 6, filter: 'blur(4px)' },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)', 
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

function TypewriterText({ text, className }) {
  return (
    <span className={className}>
      {text.split(' ').map((word, wi, arr) => (
        <span key={wi}>
          <span style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {word.split('').map((char, i) => (
              <motion.span
                key={i}
                variants={typewriterLetter}
                style={{ display: 'inline-block' }}
              >
                {char}
              </motion.span>
            ))}
          </span>
          {wi < arr.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

/* ─────────────── Hero Component ─────────────── */
export default function Hero() {
  return (
    <section className="hero-section">

      {/* Background motion visual */}
      <div className="hero-bg-visual" aria-hidden="true" />
      <div className="hero-bg-fade" aria-hidden="true" />

      {/* Mouse-following light */}
      <MouseLight />

      {/* Static ambient glow */}
      <div className="hero-glow-radial" />

      <div className="hero-inner">
        <div className="hero-content">
          {/* Headline */}
          <motion.h1 
            className="hero-headline"
            variants={typewriterContainer}
            initial="visible"
            animate="visible"
          >
            <TypewriterText text="Built by editors." />
            <br />
            <TypewriterText text="For editors." className="headline-italic" />
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            className="hero-subheadline"
            variants={typewriterContainer}
            initial="visible"
            animate="visible"
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <TypewriterText text="Buy and sell premium LUTs, presets, and transitions from the best in the craft." />
          </motion.p>

          {/* Search */}
          <AnimatedSearch />



          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-md mt-lg mb-xl">
            <Link to="/marketplace" className="btn btn-primary btn-lg btn-pill w-full sm:w-auto text-center justify-center">
              Browse Marketplace
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg btn-pill w-full sm:w-auto text-center justify-center">
              Start Selling
            </Link>
          </div>

          {/* Social Proof — replaces CTA buttons */}
          <SocialProof />
        </div>
      </div>

      <div className="hero-software-banner-wrapper">
        <SoftwareBanner />
      </div>
    </section>
  );
}
