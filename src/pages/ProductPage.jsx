import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, Link, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { 
  Star, ShoppingCart, Check, Heart, ShieldCheck, 
  Download, RefreshCw, Eye, MessageSquare, ArrowLeft,
  PlayCircle, MoreHorizontal, UserPlus, CheckCircle2, ThumbsUp, Flag
} from 'lucide-react';
import { getLocalizedString } from '../utils/i18nHelpers';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import { useGamification } from '../context/GamificationContext';
import ReportModal from '../components/common/ReportModal';
import { MOCK_PRODUCTS, MOCK_CREATORS } from '../lib/seed';
import { getProductById, getPublicProducts, createPurchase, checkHasPurchased, getReviews, submitReview, getUserReviewForProduct } from '../api/productApi';
import { supabase, isMockMode as supabaseMockMode, invokeFunction, withTimeoutSafety } from '../lib/supabase';
import ProductCard from '../components/product/ProductCard';
import './ProductPage.css';

export default function ProductPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const baseLang = (i18n.language || 'en').split('-')[0];
  const { user, profile, isMockMode, followCreator, unfollowCreator, updateProfile } = useAuth();
  const { refreshState } = useGamification();
  const { currency, formatPrice } = useCurrency();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addItem, openCart } = useCart();
  
  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };
  
  const [activeTab, setActiveTab] = useState('description');
  const [activeMedia, setActiveMedia] = useState(0);

  const getInitialProduct = () => {
    const p = location.state?.product;
    if (!p) return null;
    if (!p.id || !p.title || typeof p.price === 'undefined') {
      console.warn("ProductPage resiliency fix triggered: incomplete location.state.product passed. Forcing fresh fetch.", p);
      return null;
    }
    return p;
  };

  const initialProduct = getInitialProduct();
  const [rawProduct, setRawProduct] = useState(initialProduct);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(!initialProduct);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      if (!initialProduct) setLoading(true);
      
      const [data, ownershipStatus] = await Promise.all([
        getProductById(id, isMockMode),
        profile?.id ? checkHasPurchased(profile.id, id, isMockMode) : Promise.resolve(false)
      ]);
      
      setHasPurchased(ownershipStatus);

      if (!initialProduct) {
        setRawProduct(data || profile?.products?.find(p => String(p.id) === String(id)));
      }
      
      const allProds = await getPublicProducts(isMockMode);
      if (data || initialProduct) {
        const cat = data?.category || initialProduct?.category;
        setRelatedProducts(
          allProds.filter(p => p.category === cat && String(p.id) !== String(id)).slice(0, 4)
        );
      }
      setLoading(false);
      
      // Phase 2: Increment view count tracking in real mode
      if (!isMockMode && !supabaseMockMode) {
        supabase.rpc('increment_product_views', { product_id_param: id })
          .then(({ error }) => {
            if (error) console.error('Failed to increment views:', error);
          });
      }
    }
    loadProduct();
  }, [id, isMockMode, profile?.products]); // initialProduct derived from location.state which is stable

  const product = rawProduct ? {
    ...rawProduct,
    creator_id: rawProduct.creator_id || rawProduct.seller_id,
    creatorName: rawProduct.creator_username || rawProduct.creatorName || MOCK_CREATORS.find(c => c.id === (rawProduct.creator_id || rawProduct.seller_id))?.username || profile?.username || 'Unknown',
    reviews: rawProduct.reviews ?? rawProduct.reviews_count ?? 0,
    salePrice: rawProduct.salePrice ?? rawProduct.sale_price ?? null,
  } : null;

  // STRIP SALES COUNT FROM PUBLIC PAYLOAD FOR SECURITY
  if (product && 'sales' in product) delete product.sales;
  if (product && 'sales_count' in product) delete product.sales_count;

  const galleryMedia = useMemo(() => {
    if (!product) return [];
    if (product.media?.length > 0) return product.media;
    
    // Fallback for legacy
    const fallback = [];
    let order = 0;
    if (product.video_url) {
      fallback.push({ type: 'video', url: product.video_url, posterUrl: product.images?.[0] || '', order: order++ });
    }
    if (product.images?.length > 0) {
      product.images.forEach(img => {
        fallback.push({ type: 'image', url: img, order: order++ });
      });
    }
    return fallback;
  }, [product]);

  // ── Real reviews state ──────────────────────────────────────────────────
  const [realReviews, setRealReviews] = useState([]);
  const [ownReview, setOwnReview] = useState(null);   // current user's review if any
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewStatus, setReviewStatus] = useState(null); // 'success' | 'error' | null

  // Fetch reviews + own review whenever the product page loads or id changes
  useEffect(() => {
    if (!id || isMockMode) return;
    getReviews(id).then(setRealReviews);
    if (profile?.id) {
      getUserReviewForProduct(id, profile.id).then(existing => {
        if (existing) {
          setOwnReview(existing);
          setReviewRating(existing.rating);
          setReviewComment(existing.comment || '');
        }
      });
    }
  }, [id, isMockMode, profile?.id]);

  // Rating distribution for bar chart — computed from real data
  const ratingDistribution = useMemo(() => {
    const total = realReviews.length;
    return [5, 4, 3, 2, 1].map(star => ({
      star,
      count: realReviews.filter(r => r.rating === star).length,
      pct: total > 0 ? Math.round((realReviews.filter(r => r.rating === star).length / total) * 100) : 0,
    }));
  }, [realReviews]);

  const handleSubmitReview = async () => {
    if (!reviewRating || !profile?.id) return;
    setReviewSubmitting(true);
    setReviewStatus(null);
    const result = await submitReview({ productId: id, buyerId: profile.id, rating: reviewRating, comment: reviewComment });
    if (result.success) {
      // Refresh reviews list + own review from DB to get joined username/avatar
      const [fresh, own] = await Promise.all([
        getReviews(id),
        getUserReviewForProduct(id, profile.id),
      ]);
      setRealReviews(fresh);
      setOwnReview(own);
      setReviewStatus('success');
    } else {
      setReviewStatus('error');
    }
    setReviewSubmitting(false);
  };

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const isOwnProduct = profile && product && profile.id === product.seller_id;

  const handleFreeDownload = async () => {
    if (!profile) {
      navigate('/login');
      return;
    }
    
    setIsDownloading(true);
    
    try {
      // Create actual purchase record
      const { success, error } = await createPurchase({
        buyer_id: profile.id,
        seller_id: product.seller_id || product.creator_id, 
        product_id: product.id,
        price_paid: 0,
        currency: 'USD',
        is_free: true,
        status: 'completed'
      }, isMockMode);
      
      if (!success) {
        throw new Error(error?.message || t('product.downloadFailed', 'Failed to process free download.'));
      }
      
      // Fallback for mock mode
      if (isMockMode) {
        const currentPurchases = profile.purchases || [];
        const uniquePurchases = Array.from(new Set([...currentPurchases, product.id]));
        await updateProfile({ purchases: uniquePurchases });
      }
      
      refreshState();
      navigate('/dashboard/purchases');
    } catch (err) {
      console.error('Download error:', err);
      alert(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-2xl text-center flex items-center justify-center" style={{ minHeight: '70vh' }}>
        <div className="loader spin"></div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container py-2xl text-center flex flex-col items-center justify-center" style={{ minHeight: '70vh' }}>
        <h2>{t('common.error')}</h2>
        <button className="btn btn-primary mt-md" onClick={() => navigate('/marketplace')}>
          {t('common.back')}
        </button>
      </div>
    );
  }


  const handleAddToCart = () => {
    if (!profile) {
      navigate('/login');
      return;
    }
    addItem(product);
    openCart();
  };

  const purchaseActionsRef = useRef(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const el = purchaseActionsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product]);

  const renderMainActionButton = (compact = false) => {
    const sizeProps = compact
      ? { style: { height: '100%', padding: '0 20px', flex: 1 } }
      : { style: { height: '100%', padding: '0 24px', flex: 1 } };

    if (hasPurchased) {
      return (
        <button
          className="btn btn-primary flex-center gap-sm text-lg font-bold"
          style={sizeProps.style}
          onClick={() => navigate('/dashboard/purchases')}
        >
          View in My Purchases
        </button>
      );
    }
    if (product.salePrice === 0 || product.price === 0) {
      return (
        <button
          className="btn btn-primary flex-center gap-sm text-lg font-bold"
          style={{ ...sizeProps.style, filter: isOwnProduct ? 'grayscale(100%)' : 'none', opacity: isOwnProduct ? 0.6 : 1, cursor: isOwnProduct ? 'not-allowed' : 'pointer' }}
          onClick={isOwnProduct ? (e) => e.preventDefault() : handleFreeDownload}
          disabled={isDownloading || isOwnProduct}
        >
          <Download size={20} />
          {isDownloading ? '...' : (isOwnProduct ? 'Your Product' : 'Download for Free')}
        </button>
      );
    }
    return (
      <button
        className="btn btn-primary flex-center gap-sm text-lg font-bold"
        style={{ ...sizeProps.style, filter: isOwnProduct ? 'grayscale(100%)' : 'none', opacity: isOwnProduct ? 0.6 : 1, cursor: isOwnProduct ? 'not-allowed' : 'pointer' }}
        onClick={isOwnProduct ? (e) => e.preventDefault() : handleAddToCart}
        disabled={isOwnProduct}
      >
        <ShoppingCart size={20} />
        {isOwnProduct ? 'Your Product' : 'Add to Cart'}
      </button>
    );
  };

  return (
    <div className="product-page" style={{ paddingTop: '120px' }}>
      <div className="container pb-xl">
        <Link to="/marketplace" className="back-to-marketplace mb-lg">
          <ArrowLeft size={18} />
          {t('common.backToMarketplace') || 'Back to Marketplace'}
        </Link>
        
        <div className="product-top-section">
          {/* Gallery Area */}
          <div className="product-gallery-modern">
            <div className="main-media-area">
              {galleryMedia.length > 0 ? (
                galleryMedia[activeMedia]?.type === 'video' ? (
                  <video 
                    src={galleryMedia[activeMedia].url} 
                    controls 
                    poster={galleryMedia[activeMedia].posterUrl} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-xl)', backgroundColor: '#000' }} 
                  />
                ) : (
                  <img 
                    src={galleryMedia[activeMedia]?.url} 
                    alt={getLocalizedString(product.title, baseLang)} 
                    className="main-image"
                  />
                )
              ) : (
                <div className="video-player-placeholder">
                  <p>No media available</p>
                </div>
              )}
            </div>
            <div className="media-thumbnails">
              {galleryMedia.map((item, idx) => (
                <button 
                  key={idx} 
                  className={`media-thumb ${activeMedia === idx ? 'active' : ''}`}
                  onClick={() => setActiveMedia(idx)}
                >
                  {item.type === 'video' && <div className="video-indicator"><PlayCircle size={16}/></div>}
                  <img src={item.posterUrl || item.url} alt={`Media ${idx + 1}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Info Panel */}
          <div className="product-info flex flex-col gap-lg">
            <div className="product-header">
              <h1 className="product-page-title">{getLocalizedString(product.title, baseLang)}</h1>
              <div className="flex items-center gap-md mt-sm">
                <span className="badge bg-bg-secondary text-primary inline-block">{product.category}</span>
                <div className="stat-group cursor-pointer hover:text-primary transition-colors flex items-center gap-xs" onClick={() => setActiveTab('reviews')}>
                  <Star size={16} fill="#F59E0B" color="#F59E0B" />
                  <span className="product-stat-value font-bold">{product.rating}</span>
                  <span className="text-muted underline-hover">({product.reviews} {t('product.reviews')})</span>
                </div>
              </div>
            </div>

            <div className="product-page-price">
              {product.salePrice ? (
                <>
                  <span className="current">{formatPrice(product.salePrice)}</span>
                  <div className="product-price-large">{formatPrice(product.price)}</div>
                  <span className="save-badge">Save {Math.round((1 - product.salePrice / product.price) * 100)}%</span>
                </>
              ) : (
                <span className="current">{formatPrice(product.price)}</span>
              )}
            </div>

            <div className="purchase-actions flex flex-col gap-sm w-full" ref={purchaseActionsRef}>
              <div className="flex w-full gap-sm items-stretch" style={{ height: '56px' }}>
                {renderMainActionButton()}
                <button 
                  className={`btn flex-center ${isInWishlist(product.id) ? 'btn-secondary text-accent' : 'btn-outline text-secondary hover:text-primary'}`}
                  onClick={(e) => { e.preventDefault(); toggleWishlist(product); }}
                  aria-label="Toggle Wishlist"
                  style={{ width: '56px', height: '100%', padding: 0 }}
                >
                  <Heart size={20} fill={isInWishlist(product.id) ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="secure-badge flex-center gap-xs text-xs text-secondary justify-center">
                <ShieldCheck size={14} className="text-success" />
                Secure payment via Stripe
              </div>
            </div>

            <div className="product-features p-md rounded-xl bg-secondary">
              <div className="feature-item text-sm font-medium mb-sm flex gap-sm items-center">
                <Download size={16} className="text-accent" />
                <span>Instant Digital Download</span>
              </div>
              <div className="feature-item text-sm font-medium mb-sm flex gap-sm items-center">
                <ShieldCheck size={16} className="text-success" />
                <span>100% Secure Payment</span>
              </div>
              <div className="feature-item text-sm font-medium flex gap-sm items-center">
                <RefreshCw size={16} className="text-primary" />
                <span>Free Lifetime Updates</span>
              </div>
            </div>
          </div>
        </div>

        {/* Layout Grid for Details and Sidebar */}
        <div className="product-grid-layout mt-2xl" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-10)', alignItems: 'start' }}>
          
          <div className="product-main-content">
            <div className="tabs-header border-b mb-xl flex gap-lg">
              <button 
                className={`pb-md font-semibold text-lg transition-colors relative ${activeTab === 'description' ? 'text-primary' : 'text-muted hover:text-primary'}`}
                onClick={() => setActiveTab('description')}
              >
                {t('product.description')}
                {activeTab === 'description' && <div className="absolute bottom-0 left-0 w-full h-1 bg-accent rounded-t-full"></div>}
              </button>
              <button 
                className={`pb-md font-semibold text-lg transition-colors relative ${activeTab === 'reviews' ? 'text-primary' : 'text-muted hover:text-primary'}`}
                onClick={() => setActiveTab('reviews')}
              >
                {t('product.reviews')} <span className="ml-xs bg-secondary text-xs px-2 py-1 rounded-full">{product.reviews}</span>
                {activeTab === 'reviews' && <div className="absolute bottom-0 left-0 w-full h-1 bg-accent rounded-t-full"></div>}
              </button>
            </div>

            <div className="tab-content">
              {activeTab === 'description' && (
                <div className="description-content prose prose-lg max-w-none text-secondary">
                  <p className="text-lg leading-relaxed mb-xl">{getLocalizedString(product.description, baseLang)}</p>
                  
                  <h3 className="text-xl font-bold text-primary mt-xl mb-md">What's Included?</h3>
                  <ul className="list-disc pl-lg mb-xl space-y-sm">
                    <li>High quality assets optimized for production</li>
                    <li>Compatible with all major editing software</li>
                    <li>Detailed installation guide included (PDF + Video)</li>
                    <li>Royalty-free commercial license</li>
                  </ul>

                  <h3 className="text-xl font-bold text-primary mt-xl mb-md">Compatibility</h3>
                  <div className="flex gap-sm flex-wrap mb-xl">
                    <span className="px-md py-sm bg-secondary rounded-md text-sm font-medium">Premiere Pro</span>
                    <span className="px-md py-sm bg-secondary rounded-md text-sm font-medium">After Effects</span>
                    <span className="px-md py-sm bg-secondary rounded-md text-sm font-medium">DaVinci Resolve</span>
                    <span className="px-md py-sm bg-secondary rounded-md text-sm font-medium">Final Cut Pro</span>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="reviews-content">
                  {/* Reviews Summary */}
                  <div className="reviews-summary flex gap-xl items-center mb-2xl p-xl bg-secondary rounded-2xl">
                    <div className="text-center">
                      <div className="text-5xl font-bold font-display mb-xs">
                        {realReviews.length > 0 ? (realReviews.reduce((s, r) => s + r.rating, 0) / realReviews.length).toFixed(1) : product.rating || '—'}
                      </div>
                      <div className="flex text-warning justify-center mb-xs">
                        {[...Array(5)].map((_, i) => {
                          const avg = realReviews.length > 0 ? realReviews.reduce((s, r) => s + r.rating, 0) / realReviews.length : (product.rating || 0);
                          return <Star key={i} size={16} fill={i < Math.round(avg) ? 'currentColor' : 'none'} />;
                        })}
                      </div>
                      <div className="text-sm text-muted">Based on {realReviews.length} review{realReviews.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex-1 border-l border-border pl-xl">
                      {ratingDistribution.map(({ star, pct }) => (
                        <div key={star} className="flex items-center gap-sm mb-xs text-sm">
                          <span className="w-4">{star}</span>
                          <Star size={12} className="text-warning" fill="currentColor" />
                          <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                            <div className="h-full bg-warning transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted w-8 text-right">{pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submission / Edit Form — buyers only */}
                  {hasPurchased && !isOwnProduct && (
                    <div className="mb-2xl p-xl border border-border rounded-2xl">
                      <h4 className="font-bold mb-md">{ownReview ? 'Edit Your Review' : 'Leave a Review'}</h4>
                      {/* Star picker */}
                      <div className="flex gap-xs mb-md">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            onMouseEnter={() => setReviewHover(star)}
                            onMouseLeave={() => setReviewHover(0)}
                            className="transition-transform hover:scale-110"
                            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                          >
                            <Star
                              size={28}
                              fill={(reviewHover || reviewRating) >= star ? 'currentColor' : 'none'}
                              className={(reviewHover || reviewRating) >= star ? 'text-warning' : 'text-muted'}
                            />
                          </button>
                        ))}
                        {reviewRating > 0 && (
                          <span className="ml-sm text-sm text-muted self-center">
                            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][reviewRating]}
                          </span>
                        )}
                      </div>
                      {/* Comment */}
                      <textarea
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                        placeholder="Share your experience (optional)..."
                        rows={3}
                        className="w-full p-md border border-border rounded-lg bg-bg-card text-primary text-sm resize-none mb-md focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      {/* Status */}
                      {reviewStatus === 'success' && (
                        <p className="text-sm text-success flex items-center gap-xs mb-md"><CheckCircle2 size={14}/> Review saved!</p>
                      )}
                      {reviewStatus === 'error' && (
                        <p className="text-sm text-error mb-md">Something went wrong. Please try again.</p>
                      )}
                      <button
                        onClick={handleSubmitReview}
                        disabled={!reviewRating || reviewSubmitting}
                        className="btn-primary text-sm px-xl py-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reviewSubmitting ? 'Saving…' : ownReview ? 'Update Review' : 'Submit Review'}
                      </button>
                    </div>
                  )}

                  {/* Review List */}
                  <div className="reviews-list space-y-xl">
                    {realReviews.length > 0 ? realReviews.map(review => (
                      <div key={review.id} className="review-card border-b border-border pb-xl last:border-0">
                        <div className="flex justify-between items-start mb-md">
                          <div className="flex gap-md items-center">
                            {review.buyer?.avatar_url ? (
                              <img src={review.buyer.avatar_url} alt={review.buyer?.username} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(review.buyer?.username || 'User')}&background=random`} alt={review.buyer?.username} className="w-10 h-10 rounded-full" />
                            )}
                            <div>
                              <div className="font-bold flex items-center gap-sm">
                                {review.buyer?.username || 'Anonymous'}
                                <span className="text-xs text-success bg-success-subtle px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 size={10}/> Verified Buyer
                                </span>
                              </div>
                              <div className="review-date">{new Date(review.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div className="flex text-warning">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={14} fill={i < review.rating ? 'currentColor' : 'none'} color={i < review.rating ? 'currentColor' : 'var(--color-border)'} />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-secondary leading-relaxed">{review.comment}</p>
                        )}
                      </div>
                    )) : (
                      <p className="text-muted text-center py-xl">No reviews yet. {hasPurchased && !isOwnProduct ? 'Be the first to leave one!' : ''}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="product-sidebar">
            <div className="creator-card glass-card p-xl flex flex-col items-center text-center">
              <img src={`https://ui-avatars.com/api/?name=${product.creatorName}&background=random`} alt={product.creatorName} className="w-24 h-24 rounded-full border-4 border-bg mb-md shadow-md" />
              <h3 className="font-bold text-xl flex items-center justify-center gap-xs mb-xs">
                {product.creatorName} <ShieldCheck size={18} className="text-accent" />
              </h3>
              <p className="text-sm text-muted mb-lg">Top Rated Seller • Joined 2024</p>
              
              <div className="w-full flex justify-around mb-lg pb-lg border-b border-border">
                <div className="text-center">
                  <div className="font-bold text-lg">4.9</div>
                  <div className="text-xs text-muted">Rating</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">24</div>
                  <div className="text-xs text-muted">Products</div>
                </div>
              </div>

              <div className="flex flex-col gap-sm w-full">
                {(!user || user.id !== product.creator_id) && (
                  <button 
                    className={`btn w-full flex-center gap-sm ${profile?.following?.find(f => f.creatorId === product.creator_id) ? 'btn-secondary text-accent' : 'btn-outline'}`}
                    onClick={() => {
                      if (!user) {
                        navigate('/login');
                        return;
                      }
                      if (profile?.following?.find(f => f.creatorId === product.creator_id)) {
                        unfollowCreator(product.creator_id);
                      } else {
                        followCreator(product.creator_id);
                      }
                    }}
                  >
                    <UserPlus size={16} /> 
                    {profile?.following?.find(f => f.creatorId === product.creator_id) ? 'Following' : 'Follow Creator'}
                  </button>
                )}
                <Link to={`/creator/${product.creatorName}`} className="btn btn-primary w-full flex-center gap-sm">
                  View Full Store
                </Link>
                {hasPurchased && !isOwnProduct && (
                  <button 
                    className="btn btn-secondary w-full flex-center gap-sm mt-xs"
                    onClick={() => {
                      navigate('/dashboard/messages', {
                        state: {
                          startNewChat: true,
                          sellerId: product.seller_id || product.creator_id,
                          sellerName: product.creatorName,
                          productId: product.id,
                          productTitle: typeof product.title === 'string' ? product.title : Object.values(product.title)[0]
                        }
                      });
                    }}
                  >
                    <MessageSquare size={16} /> Message Seller
                  </button>
                )}
              </div>
            </div>

            <div className="glass-card p-xl mt-lg">
              <h4 className="font-bold mb-md">Product Details</h4>
              <ul className="space-y-sm text-sm">
                <li className="flex justify-between border-b border-border pb-sm"><span className="text-muted">Published</span> <span className="font-medium">Oct 12, 2026</span></li>
                <li className="flex justify-between border-b border-border pb-sm"><span className="text-muted">File Size</span> <span className="font-medium">245 MB</span></li>
                <li className="flex justify-between border-b border-border pb-sm"><span className="text-muted">Format</span> <span className="font-medium">ZIP / .cube</span></li>
                <li className="flex justify-between border-b border-border pb-sm"><span className="text-muted">License</span> <span className="font-medium underline cursor-pointer">Standard</span></li>
                <li className="flex justify-between"><span className="text-muted">Version</span> <span className="font-medium">1.2.0</span></li>
              </ul>
              <button 
                className="mt-lg w-full text-sm text-secondary hover:text-red-500 transition-colors flex items-center justify-center gap-xs py-sm border border-transparent hover:bg-bg-secondary hover:border-border rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReportModalOpen(true);
                }}
              >
                <Flag size={14} /> Report Product
              </button>
            </div>
          </div>

        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="related-products mt-4xl pt-2xl border-t border-border">
            <h2 className="section-title mb-xl">{t('product.relatedProducts')}</h2>
            <div className="products-grid">
              {relatedProducts.map(related => (
                <ProductCard key={related.id} product={related} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        type="product" 
        targetId={product.id} 
      />

      {/* Sticky mobile buy bar — appears once the real purchase actions
          scroll out of view, so buying never requires scrolling back up */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            className="sticky-buy-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="sticky-buy-bar-price">
              {product.salePrice ? (
                <>
                  <span className="sticky-buy-bar-current">{formatPrice(product.salePrice)}</span>
                  <span className="sticky-buy-bar-was">{formatPrice(product.price)}</span>
                </>
              ) : (
                <span className="sticky-buy-bar-current">{formatPrice(product.price)}</span>
              )}
            </div>
            <div className="sticky-buy-bar-action">
              {renderMainActionButton(true)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
