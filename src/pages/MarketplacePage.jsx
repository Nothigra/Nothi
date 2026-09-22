import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Search, X, ChevronDown, ChevronRight, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from '../components/product/ProductCard';
import { getLocalizedString } from '../utils/i18nHelpers';
import { useAuth } from '../context/AuthContext';
import { getPublicProducts } from '../api/productApi';
import { MOCK_CREATORS, CATEGORIES as categories, SOFTWARE_LIST as softwareList, STYLE_LIST as styleList } from '../lib/seed';
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

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true); // Distinct local loading state

  const [selectedPrice, setSelectedPrice] = useState(savedFilters?.selectedPrice || 'all');
  const [selectedRating, setSelectedRating] = useState(savedFilters?.selectedRating || 'all');
  const [selectedSoftware, setSelectedSoftware] = useState(savedFilters?.selectedSoftware || profile?.software || []);
  const [selectedStyle, setSelectedStyle] = useState(savedFilters?.selectedStyle || profile?.style || []);
  const [showPaid, setShowPaid] = useState(savedFilters?.showPaid !== undefined ? savedFilters.showPaid : true);
  const [showFree, setShowFree] = useState(savedFilters?.showFree !== undefined ? savedFilters.showFree : false);
  // Mobile filter sheet navigation: 'main' shows Paid/Free + the 3 category
  // buttons; drilling into one shows its own checkbox list with a back arrow.
  const [filterView, setFilterView] = useState('main');
  const [sortBy, setSortBy] = useState(savedFilters?.sortBy || 'newest');
  
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { results: searchResults, debouncedQuery } = useUnifiedSearch(searchTerm, baseLang);
  
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    if (!isFiltersOpen) setFilterView('main');
  }, [isFiltersOpen]);
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

  useEffect(() => {
    let isMounted = true;
    async function loadProducts() {
      if (isAuthLoading) return;
      setLoading(true);
      const data = await getPublicProducts(isMockMode);
      if (isMounted) {
        setProducts(data);
        setLoading(false);
      }
    }
    loadProducts();
    return () => { isMounted = false; };
  }, [isMockMode, isAuthLoading]);

  const priceRanges = [
    { id: 'all', label: t('marketplace.priceRange') },
    { id: 'free', label: t('common.free'), min: 0, max: 0 },
    { id: 'under25', label: 'Under $25', min: 0, max: 24.99 },
    { id: '25to50', label: '$25 - $50', min: 25, max: 50 },
    { id: 'over50', label: '$50+', min: 50.01, max: 9999 }
  ];

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

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(p => {
        const title = getLocalizedString(p.title, baseLang).toLowerCase();
        const desc = getLocalizedString(p.description, baseLang).toLowerCase();
        const creatorName = (p.creatorName || '').toLowerCase();
        
        const mockCreator = MOCK_CREATORS.find(c => c.id === p.creator_id);
        const mockCreatorUsername = (mockCreator?.username || '').toLowerCase();
        
        let tagsArray = [];
        if (Array.isArray(p.tags)) {
          tagsArray = p.tags;
        } else if (p.tags) {
          tagsArray = p.tags[baseLang] || p.tags.en || Object.values(p.tags)[0] || [];
        }

        return (
          title.includes(lowerSearch) || 
          desc.includes(lowerSearch) ||
          creatorName.includes(lowerSearch) ||
          mockCreatorUsername.includes(lowerSearch) ||
          tagsArray.some(tag => tag.toLowerCase().includes(lowerSearch))
        );
      });
    }

    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (!(showPaid && showFree)) {
      result = result.filter(p => {
        const price = p.salePrice || p.sale_price || p.price || 0;
        const isFree = price === 0;
        return isFree ? showFree : showPaid;
      });
    }

    if (selectedPrice !== 'all') {
      const range = priceRanges.find(r => r.id === selectedPrice);
      if (range) {
        result = result.filter(p => {
          const price = p.salePrice || p.sale_price || p.price;
          return price >= range.min && price <= range.max;
        });
      }
    }

    if (selectedRating !== 'all') {
      const range = ratingRanges.find(r => r.id === selectedRating);
      if (range) {
        result = result.filter(p => p.rating >= range.min);
      }
    }

    if (selectedSoftware.length > 0) {
      result = result.filter(p => 
        p.software && p.software.some(sw => selectedSoftware.includes(sw))
      );
    }

    if (selectedStyle.length > 0) {
      result = result.filter(p => 
        p.style && p.style.some(st => selectedStyle.includes(st))
      );
    }

    result.sort((a, b) => {
      // Dedicated ranking score keeping metrics independent
      const getRankingScore = (p) => {
        if (!isMockMode) {
          return p.popular_rank || 0;
        }
        const salesWeight = p.sales_count || 0;
        const boostWeight = p.boost && new Date(p.boost.endDate) > new Date() ? 10000 : 0;
        return salesWeight + boostWeight;
      };

      const priceA = a.salePrice || a.sale_price || a.price;
      const priceB = b.salePrice || b.sale_price || b.price;
      
      switch (sortBy) {
        case 'newest': 
          if (!isMockMode) {
            return new Date(b.created_at) - new Date(a.created_at);
          }
          const idA = parseInt(a.id.replace(/\D/g, '') || 0) + (a.boost && new Date(a.boost.endDate) > new Date() ? 10000 : 0);
          const idB = parseInt(b.id.replace(/\D/g, '') || 0) + (b.boost && new Date(b.boost.endDate) > new Date() ? 10000 : 0);
          return idB - idA;
        case 'popular': 
          if (!isMockMode) {
            // popular_rank is ASCENDING (1 is best)
            return getRankingScore(a) - getRankingScore(b);
          }
          return getRankingScore(b) - getRankingScore(a);
        case 'priceLow': return priceA - priceB;
        case 'priceHigh': return priceB - priceA;
        default: return 0;
      }
    });

    return result;
  }, [products, searchTerm, selectedCategory, selectedPrice, selectedRating, selectedSoftware, selectedStyle, showPaid, showFree, sortBy]);

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
              isVisible={isSearchFocused}
              onClose={() => setIsSearchFocused(false)}
            />
          </div>
        </div>
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
          {filteredProducts.length} results
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
          <div className="filter-sections-flat">
          <div className="filter-group">
            <h4 className="filter-title">{t('upload.category', 'Category')}</h4>
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
          </div>          <div className="filter-group">
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
            {filterView === 'main' && (
              <div className="filter-group">
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
              </div>
            )}

            {filterView === 'category' && (
              <div className="filter-group">
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
              </div>
            )}

            {filterView === 'software' && (
              <div className="filter-group">
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
              </div>
            )}

            {filterView === 'style' && (
              <div className="filter-group">
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
              </div>
            )}
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

          <button className="btn btn-outline w-full mt-6" onClick={clearFilters}>
            {t('marketplace.clearFilters')}
          </button>
        </aside>
        </PortalWhen>

        {/* Main Content */}
        <main className="marketplace-content" layout="true">
          {loading ? (
            <BrandedLoader />
          ) : filteredProducts.length > 0 ? (
            <motion.div 
              className="products-grid-view"
              layout
            >
              <AnimatePresence mode="popLayout">
                {filteredProducts.map(product => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
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
