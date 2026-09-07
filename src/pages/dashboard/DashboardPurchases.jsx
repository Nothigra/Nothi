import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Download, ShoppingBag, ExternalLink, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { messagingService } from '../../lib/MessagingService';
import { useCurrency } from '../../context/CurrencyContext';
import { getUserPurchases, getPublicProducts, requestDownloadUrl } from '../../api/productApi';
import { useTranslation } from 'react-i18next';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { getThumbnailUrl } from '../../utils/mediaHelpers';
import './DashboardPages.css';

export default function DashboardPurchases() {
  const { profile, isMockMode } = useAuth();
  const { formatPrice } = useCurrency();
  const { i18n } = useTranslation();
  const baseLang = (i18n.language || 'en').split('-')[0];
  const navigate = useNavigate();

  const [purchasedProducts, setPurchasedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!profile?.id) {
        setPurchasedProducts([]);
        setIsLoading(false);
        return;
      }
      
      const purchases = await getUserPurchases(profile.id, isMockMode);
      
      if (isMockMode && (!purchases || purchases.length === 0) && profile.purchases) {
        // Fallback to legacy mock behavior for test user 1
        const allProducts = await getPublicProducts(isMockMode);
        const mockPurchased = profile.purchases.map(id => 
          allProducts.find(p => String(p.id) === String(id))
        ).filter(Boolean).map(product => ({ 
          id: `mock-${product.id}`, 
          product, 
          price_paid: product.salePrice || product.price, 
          purchased_at: new Date().toISOString() 
        }));
        setPurchasedProducts(mockPurchased);
      } else {
        setPurchasedProducts(purchases || []);
      }
      
      setIsLoading(false);
      setIsLoading(false);
    }
    loadData();
  }, [profile?.purchases, isMockMode]);

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-page-header">
          <div>
            <h1 className="dashboard-title">My Purchases</h1>
            <p className="dashboard-subtitle">Products you've bought on Nothi.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-xl)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="purchase-card glass-card" style={{ height: 400, borderRadius: 'var(--radius-xl)' }}>
              <div className="skeleton" style={{ height: '50%', borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)' }}></div>
              <div style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
                <div className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-md)', marginTop: 'auto' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleDownload = async (purchase) => {
    const productId = purchase.product?.id;
    if (!productId) return;
    setDownloadingId(purchase.id);
    setDownloadError('');
    try {
      const { downloadUrl } = await requestDownloadUrl(productId);
      // Trigger browser download via a temporary anchor
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      if (err.error === 'no_file') {
        setDownloadError(`"${purchase.product?.title ? (typeof purchase.product.title === 'string' ? purchase.product.title : Object.values(purchase.product.title)[0]) : 'This product'}" — the seller hasn't uploaded a file yet. Contact them for assistance.`);
      } else {
        setDownloadError(err.message || 'Download failed. Please try again.');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleContactSeller = (purchase) => {
    if (!purchase.product) return;
    
    if (isMockMode) {
      const conv = messagingService.getOrCreateConversation(
        profile.id,
        purchase.seller_id || purchase.product.creator_id,
        purchase.product.id
      );
      navigate('/dashboard/messages', { state: { activeChatId: conv.id } });
    } else {
      navigate('/dashboard/messages', {
        state: {
          startNewChat: true,
          sellerId: purchase.seller_id || purchase.product.creator_id,
          productId: purchase.product.id,
          productTitle: typeof purchase.product.title === 'string' ? purchase.product.title : Object.values(purchase.product.title)[0]
        }
      });
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-header">
        <div>
          <h1 className="dashboard-title">My Purchases</h1>
          <p className="dashboard-subtitle">Products you've bought on Nothi.</p>
        </div>
      </div>

      {downloadError && (
        <div className="dashboard-card mb-lg flex items-start gap-sm" style={{ background: 'var(--color-danger-subtle, rgba(239,68,68,0.08))', border: '1px solid var(--color-danger, #ef4444)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md) var(--space-lg)' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-danger, #ef4444)', flexShrink: 0, marginTop: 2 }} />
          <span className="text-sm" style={{ color: 'var(--color-danger, #ef4444)' }}>{downloadError}</span>
          <button onClick={() => setDownloadError('')} style={{ marginLeft: 'auto', opacity: 0.6 }}>×</button>
        </div>
      )}

      {purchasedProducts.length === 0 ? (
        <div className="dashboard-card text-center py-2xl">
          <ShoppingBag size={48} className="mb-md text-secondary" style={{ opacity: 0.3 }} />
          <p className="text-secondary mb-md">You haven't purchased any products yet.</p>
          <Link to="/marketplace" className="btn btn-primary">Browse Marketplace</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-xl)' }}>
          {purchasedProducts.map((purchase) => {
            const product = purchase.product;
            if (!product) {
              return (
                <div key={purchase.id} className="purchase-card glass-card flex-center flex-col p-2xl text-center" style={{ borderRadius: 'var(--radius-xl)', border: '2px dashed var(--color-border)' }}>
                   <div className="bg-secondary p-md rounded-full mb-md"><ShoppingBag size={24} className="text-muted" /></div>
                   <h3 className="font-bold text-lg mb-xs">Product Unavailable</h3>
                   <p className="text-muted text-sm mb-md">This product is no longer available from the creator.</p>
                   <span className="badge font-bold">{formatPrice(purchase.price_paid)}</span>
                </div>
              );
            }

            return (
            <div 
              key={purchase.id} 
              className="purchase-card glass-card"
              style={{
                borderRadius: 'var(--radius-xl)',
                border: '2px solid var(--color-border)',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.08)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                background: 'linear-gradient(145deg, var(--color-bg-card) 0%, var(--color-bg-secondary) 100%)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.borderColor = 'var(--color-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              <div style={{ height: '180px', width: '100%', position: 'relative' }}>
                <img 
                  src={getThumbnailUrl(product) || `https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=300&fit=crop&q=80&sig=${product.id}`} 
                  alt={getLocalizedString(product.title, baseLang)} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                  <span className="badge font-bold" style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)', padding: '6px 12px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    {formatPrice(purchase.price_paid || product.price)}
                  </span>
                </div>
              </div>
              <div style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="flex items-center justify-between mb-sm">
                  <span className="text-secondary text-sm font-medium tracking-wide uppercase">{product.category}</span>
                </div>
                <h3 className="font-bold text-xl mb-xl" style={{ color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                  {getLocalizedString(product.title, baseLang)}
                </h3>
                
                <div className="mt-auto flex gap-md">
                  <button 
                    className="btn btn-primary flex-1 flex-center gap-sm font-bold" 
                    onClick={() => handleDownload(purchase)}
                    disabled={downloadingId === purchase.id}
                    style={{ height: '48px' }}
                  >
                    {downloadingId === purchase.id
                      ? <><span className="loader spin" style={{ width: 16, height: 16, borderWidth: 2 }} /> Preparing…</>
                      : <><Download size={18} /> Download</>
                    }
                  </button>
                  <Link 
                    to={`/product/${product.id}`} 
                    className="btn btn-outline flex-center" 
                    title="View Product Page"
                    style={{ width: '48px', height: '48px', padding: 0 }}
                  >
                    <ExternalLink size={18} />
                  </Link>
                </div>
                <button 
                  className="btn btn-outline w-full flex-center gap-sm mt-sm" 
                  onClick={() => handleContactSeller(purchase)}
                >
                  <MessageSquare size={16} /> Contact Seller
                </button>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
}
