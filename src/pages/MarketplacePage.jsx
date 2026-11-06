import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Search, X, ChevronDown, ChevronRight, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import ProductCard from '../components/product/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useScreenFocus } from '../lib/screenFocus';
import { queryPublicProducts } from '../api/productApi';
import { CATEGORIES as categories, SOFTWARE_LIST as softwareList, STYLE_LIST as styleList } from '../lib/seed';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Checkbox from '../components/ui/Checkbox';
import PortalWhen from '../components/common/PortalWhen';
import { useUnifiedSearch } from '../hooks/useUnifiedSearch';
import SearchDropdown from '../components/common/SearchDropdown';
import BrandedLoader from '../components/common/BrandedLoader';
import './MarketplacePage.css';

export default function MarketplacePage() {
  const { t, i18n } = useTranslation();
  const { profile, isMockMode, isLoading: isAuthLoading } = useAuth();
  
  const baseLang = (i18n.language || 'en').split('-')[0];

  const savedFilters = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('marketplaceFilters');
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  }, []);

  const [searchTerm, setSearchTerm] = useState(savedFilters?.searchTerm || '');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const searchInputRef = useRef(null);

  // The mobile filter sheet is portaled straight to <body> so it can
  // visually stack above the floating bottom nav — normal in-place
  // rendering is trapped inside Layout's page-transition wrapper (which
  // animates transform/filter, creating a stacking context nothing inside
  // it can escape via z-index alone). Desktop/tablet keep the sidebar as a
  // normal flex child of the layout, unaffected.
  const [isMobileFilterViewport, setIsMobileFilterViewport] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  useEffect(() => {
    const handleResize = () => setIsMobileFilterViewport(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // ?q= (from the app's search screen) fills the search box
  const queryParam = searchParams.get('q');
  useEffect(() => {
    if (queryParam != null) setSearchTerm(queryParam);
  }, [queryParam]);
  const rawCategory = searchParams.get('category');
  const isValidCategory = rawCategory === 'all' || categories.some(c => c.id === rawCategory);
  const selectedCategory = rawCategory && isValidCategory ? rawCategory : 'all';

  const handleCategoryChange = (catId) => {
    setSearchParams(prev => {
      if (catId === 'all') {
        prev.delete('category');
      } else {
        prev.set('category', catId);
      }
      return prev;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Products come page by page from the database (filters + sort run there)
  const PAGE_SIZE = 24;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const sentinelRef = useRef(null);

  const [selectedPrice, setSelectedPrice] = useState(savedFilters?.selectedPrice || 'all');
  const [selectedRating, setSelectedRating] = useState(savedFilters?.selectedRating || 'all');
  const [selectedSoftware, setSelectedSoftware] = useState(savedFilters?.selectedSoftware || profile?.software || []);
  const [selectedStyle, setSelectedStyle] = useState(savedFilters?.selectedStyle || profile?.style || []);
  const [showPaid, setShowPaid] = useState(savedFilters?.showPaid !== undefined ? savedFilters.showPaid : true);
  const [showFree, setShowFree] = useState(savedFilters?.showFree !== undefined ? savedFilters.showFree : true);
  // Mobile filter sheet navigation: 'main' shows Paid/Free + the 3 category
  // buttons; drilling into one shows its own checkbox list with a back arrow.
  const [filterView, setFilterView] = useState('main');
  const [sortBy, setSortBy] = useState(savedFilters?.sortBy || 'newest');
  
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { results: searchResults, debouncedQuery, isSearching: searchPending } = useUnifiedSearch(searchTerm, baseLang);
  
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    if (!isFiltersOpen) setFilterView('main');
  }, [isFiltersOpen]);
  // The filter sheet is portaled: close it when this screen is hidden (app tabs stay mounted)
  const { active: screenActive } = useScreenFocus();
  useEffect(() => { if (!screenActive) setIsFiltersOpen(false); }, [screenActive]);
  // Phone: the page behind the filter sheet doesn't scroll
  useEffect(() => {
    if (!(isFiltersOpen && isMobileFilterViewport)) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFiltersOpen, isMobileFilterViewport]);
  const [hasInitializedFilters, setHasInitializedFilters] = useState(!!savedFilters || !!profile?.software);

  // Coming from the mobile header's search icon: jump straight into the search field
  useEffect(() => {
    if (location.state?.focusSearch) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [location.state]);

  // Sync profile software and style filters when auth loads if no session storage exists
  useEffect(() => {
    if (!savedFilters && !hasInitializedFilters) {
      if (profile?.software) setSelectedSoftware(profile.software);
      if (profile?.style) setSelectedStyle(profile.style);
      if (profile?.software || profile?.style) setHasInitializedFilters(true);
    }
  }, [profile?.software, profile?.style, hasInitializedFilters, savedFilters]);

  // Persist filters to session storage
  useEffect(() => {
    sessionStorage.setItem('marketplaceFilters', JSON.stringify({
      searchTerm, selectedPrice, selectedRating, selectedSoftware, selectedStyle, showPaid, showFree, sortBy
    }));
  }, [searchTerm, selectedPrice, selectedRating, selectedSoftware, selectedStyle, showPaid, showFree, sortBy]);

  const priceRanges = [
    { id: 'all', label: t('marketplace.priceRange') },
    { id: 'free', label: t('common.free'), min: 0, max: 0 },
    { id: 'under25', label: 'Under €25', min: 0, max: 24.99 },
    { id: '25to50', label: '€25 - €50', min: 25, max: 50 },
    { id: 'over50', label: '€50+', min: 50.01, max: 9999 }
  ];

  // What the database is asked for — rebuilt only when a filter really changes
  const softwareKey = selectedSoftware.join('|');
  const styleKey = selectedStyle.join('|');
  const query = useMemo(() => {
    const range = priceRanges.find(r => r.id === selectedPrice);
    const rating = { '4': 4, '3': 3 }[selectedRating];
    return {
      category: selectedCategory,
      software: softwareKey ? softwareKey.split('|') : [],
      style: styleKey ? styleKey.split('|') : [],
      free: showPaid === showFree ? undefined : showFree,
      priceMin: range && range.id !== 'all' ? range.min : undefined,
      priceMax: range && range.id !== 'all' ? range.max : undefined,
      minRating: rating,
      search: debouncedQuery || '',
      sort: sortBy,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, softwareKey, styleKey, showPaid, showFree, selectedPrice, selectedRating, debouncedQuery, sortBy]);

  useEffect(() => {
    if (isAuthLoading) return;
    let alive = true;
    setLoading(true);
    queryPublicProducts({ ...query, limit: PAGE_SIZE, offset: 0 }, isMockMode).then(({ items, count }) => {
      if (!alive) return;
      setProducts(items);
      setTotalCount(count);
      setHasMore(items.length === PAGE_SIZE);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [query, isMockMode, isAuthLoading, location.key]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { items } = await queryPublicProducts({ ...query, limit: PAGE_SIZE, offset: products.length }, isMockMode);
    setProducts(prev => {
      const seen = new Set(prev.map(p => p.id));
      return [...prev, ...items.filter(p => !seen.has(p.id))];
    });
    setHasMore(items.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, query, products.length, isMockMode]);

  // Infinite scroll: load the next page a little before the end of the grid
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) loadMore();
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);


  const ratingRanges = [
    { id: 'all', label: t('marketplace.rating') },
    { id: '4', label: '4+ Stars', min: 4 },
    { id: '3', label: '3+ Stars', min: 3 }
  ];

  const sortOptions = [
    { id: 'newest', label: t('marketplace.newest') },
    { id: 'popular', label: t('marketplace.popular') },
    { id: 'priceLow', label: t('marketplace.priceLow') },
    { id: 'priceHigh', label: t('marketplace.priceHigh') }
  ];

  // Filtering and sorting run in the database (queryPublicProducts)
  const filteredProducts = products;

  const toggleSoftware = (sw) => {
    setSelectedSoftware(prev => 
      prev.includes(sw) 
        ? prev.filter(item => item !== sw)
        : [...prev, sw]
    );
  };

  const toggleStyle = (st) => {
    setSelectedStyle(prev => 
      prev.includes(st) 
        ? prev.filter(item => item !== st)
        : [...prev, st]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    handleCategoryChange('all');
    setSelectedPrice('all');
    setSelectedRating('all');
    setSelectedSoftware([]);
    setSelectedStyle([]);
    setSortBy('newest');
  };

  return (
    <div className="marketplace-page container-2xl pb-4xl mb-4xl">
      <div className="marketplace-header-inline">
        <div className="marketplace-header-text">
          <h1 className="page-title">Marketplace</h1>
          <p className="page-subtitle text-muted">Discover premium assets from top creators</p>
        </div>
        
        <div className="marketplace-header-right">

          <div style={{ flex: 1, maxWidth: '500px', position: 'relative', zIndex: 100 }}>
            <Input 
              ref={searchInputRef}
              iconLeft={Search}
              placeholder={t('marketplace.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              clearable={true}
              onClear={() => setSearchTerm('')}
              onFocus={() => setIsSearchFocused(true)}
              size="sm"
              className="marketplace-search-input"
              wrapperClassName="hero-search-input-wrapper"
            />
            <SearchDropdown 
              query={searchTerm}
              debouncedQuery={debouncedQuery}
              results={searchResults}
              isSearching={searchPending}
              isVisible={isSearchFocused}
              onClose={() => setIsSearchFocused(false)}
            />
          </div>
        </div>
      </div>


      {/* Categories, always one tap away */}
      <div className="marketplace-cats" role="tablist" aria-label="Categories">
        {[{ id: 'all', name: t('marketplace.allCategories', 'All') }, ...categories].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selectedCategory === c.id}
            className={`marketplace-cat ${selectedCategory === c.id ? 'active' : ''}`}
            onClick={() => handleCategoryChange(c.id)}
          >
            {c.id === 'all' ? c.name : t(`categories.${c.id}`, { defaultValue: c.name })}
          </button>
        ))}
      </div>

      <div className="marketplace-toolbar">
        <button 
          className={`btn btn-sm btn-outline ${isFiltersOpen ? 'active' : ''}`}
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
        >
          <SlidersHorizontal size={14} /> 
          <span>{isFiltersOpen ? 'Hide Filters' : 'Filters'}</span>
        </button>

        <span className="toolbar-results text-muted">
          {totalCount ?? filteredProducts.length} results
        </span>

        <div className="toolbar-spacer"></div>

        <div className="toolbar-sort" style={{ minWidth: '140px' }}>
          <Select 
            value={sortBy}
            onChange={(val) => setSortBy(val)}
            options={sortOptions.map(opt => ({ value: opt.id, label: opt.label }))}
            className="marketplace-sort-select"
            wrapperClassName="marketplace-sort-wrapper"
          />
        </div>
      </div>

      <div className={`marketplace-layout ${isFiltersOpen ? 'filters-open' : 'filters-closed'}`}>
        {/* Sidebar Filters */}
        <PortalWhen active={isMobileFilterViewport}>
        <aside className={`marketplace-sidebar ${isFiltersOpen ? 'open' : 'sidebar-closed'}`}>
          <div className="sidebar-header hidden-desktop">
            <h3>{t('marketplace.filters')}</h3>
            <button className="btn-icon" onClick={() => setIsFiltersOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="filter-group">
            <h4 className="filter-title">{t('marketplace.priceType', 'Price')}</h4>
            <div className="filter-options">
              <div style={{ marginBottom: '8px' }}>
                <Checkbox label="Paid" checked={showPaid} onChange={() => setShowPaid(v => !v)} />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <Checkbox label="Free" checked={showFree} onChange={() => setShowFree(v => !v)} />
              </div>
            </div>
          </div>

          {/* Desktop/tablet: every section visible at once (plenty of room) */}
          {/* (categories are already the pills above the grid) */}
          <div className="filter-sections-flat">
          <div className="filter-group">
            <h4 className="filter-title">Software</h4>
            <div className="filter-options">
              {softwareList.map(sw => (
                <div key={sw} style={{ marginBottom: '8px' }}>
                  <Checkbox 
                    label={sw}
                    checked={selectedSoftware.includes(sw)}
                    onChange={() => toggleSoftware(sw)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <h4 className="filter-title">Style</h4>
            <div className="filter-options">
              {styleList.map(st => (
                <div key={st} style={{ marginBottom: '8px' }}>
                  <Checkbox 
                    label={st}
                    checked={selectedStyle.includes(st)}
                    onChange={() => toggleStyle(st)}
                  />
                </div>
              ))}
            </div>
          </div>
          </div>

          {/* Mobile: Category/Software/Style tucked behind a 3-button menu,
              drilling into one at a time instead of a long single scroll */}
          <div className="filter-sections-drilldown">
            <AnimatePresence mode="wait" initial={false}>
            {filterView === 'main' && (
              <motion.div key="main" className="filter-group" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                <div className="filter-nav-list">
                  <button className="filter-nav-btn" onClick={() => setFilterView('category')}>
                    <span>Category</span>
                    <span className="filter-nav-btn-right">
                      {selectedCategory !== 'all' && <span className="filter-nav-count">1</span>}
                      <ChevronRight size={18} />
                    </span>
                  </button>
                  <button className="filter-nav-btn" onClick={() => setFilterView('software')}>
                    <span>Software</span>
                    <span className="filter-nav-btn-right">
                      {selectedSoftware.length > 0 && <span className="filter-nav-count">{selectedSoftware.length}</span>}
                      <ChevronRight size={18} />
                    </span>
                  </button>
                  <button className="filter-nav-btn" onClick={() => setFilterView('style')}>
                    <span>Style</span>
                    <span className="filter-nav-btn-right">
                      {selectedStyle.length > 0 && <span className="filter-nav-count">{selectedStyle.length}</span>}
                      <ChevronRight size={18} />
                    </span>
                  </button>
                </div>
              </motion.div>
            )}

            {filterView === 'category' && (
              <motion.div key="category" className="filter-group" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                <button className="filter-back-btn" onClick={() => setFilterView('main')}>
                  <ArrowLeft size={16} /> Category
                </button>
                <div className="filter-options">
                  <button 
                    className={`filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => handleCategoryChange('all')}
                  >
                    {t('marketplace.allCategories', 'All Categories')}
                  </button>
                  {categories.map(cat => {
                    const count = products.filter(p => p.category === cat.id).length;
                    return (
                      <button 
                        key={cat.id}
                        className={`filter-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => handleCategoryChange(cat.id)}
                      >
                        {cat.name} <span className="text-muted">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {filterView === 'software' && (
              <motion.div key="software" className="filter-group" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                <button className="filter-back-btn" onClick={() => setFilterView('main')}>
                  <ArrowLeft size={16} /> Software
                </button>
                <div className="filter-options">
                  {softwareList.map(sw => (
                    <div key={sw} style={{ marginBottom: '8px' }}>
                      <Checkbox 
                        label={sw}
                        checked={selectedSoftware.includes(sw)}
                        onChange={() => toggleSoftware(sw)}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {filterView === 'style' && (
              <motion.div key="style" className="filter-group" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                <button className="filter-back-btn" onClick={() => setFilterView('main')}>
                  <ArrowLeft size={16} /> Style
                </button>
                <div className="filter-options">
                  {styleList.map(st => (
                    <div key={st} style={{ marginBottom: '8px' }}>
                      <Checkbox 
                        label={st}
                        checked={selectedStyle.includes(st)}
                        onChange={() => toggleStyle(st)}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          <div className="filter-group">
            <h4 className="filter-title">{t('marketplace.priceRange')}</h4>
            <div className="filter-options">
              {priceRanges.map(range => (
                <button 
                  key={range.id}
                  className={`filter-btn ${selectedPrice === range.id ? 'active' : ''}`}
                  onClick={() => setSelectedPrice(range.id)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <h4 className="filter-title">{t('marketplace.rating')}</h4>
            <div className="filter-options">
              {ratingRanges.map(range => (
                <button 
                  key={range.id}
                  className={`filter-btn ${selectedRating === range.id ? 'active' : ''}`}
                  onClick={() => setSelectedRating(range.id)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-outline w-full filter-clear-btn" onClick={clearFilters}>
            {t('marketplace.clearFilters')}
          </button>
        </aside>
        </PortalWhen>

        {/* Main Content */}
        <main className="marketplace-content" layout="true">
          {loading ? (
            <BrandedLoader />
          ) : filteredProducts.length > 0 ? (
            <>
              <div className="products-grid-view">
                {filteredProducts.map(product => (
                  <div key={product.id} className="grid-fade-in"><ProductCard product={product} /></div>
                ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef} className="grid-more">
                  <button className="btn btn-outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? t('common.loading', 'Loading…') : t('marketplace.loadMore', 'Show more')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Search size={40} className="text-muted mb-md" />
              <h3>{t('marketplace.noProducts')}</h3>
              <p className="text-muted">{t('marketplace.noProductsDesc')}</p>
              <button className="btn btn-primary mt-md" onClick={clearFilters}>
                {t('marketplace.clearFilters')}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Overlay */}
      <PortalWhen active={isMobileFilterViewport}>
      <AnimatePresence>
        {isFiltersOpen && (
          <motion.div
            className="mobile-overlay hidden-desktop"
            onClick={() => setIsFiltersOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      </PortalWhen>
    </div>
  );
}
