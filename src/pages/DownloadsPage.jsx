import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { DownloadCloud, CloudDownload, ShoppingBag } from 'lucide-react';
import { formatDate } from '../utils/helpers';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import { getUserPurchases, getPublicProducts, requestDownloadUrl } from '../api/productApi';
import { getLocalizedString } from '../utils/i18nHelpers';
import './DownloadsPage.css';

export default function DownloadsPage() {
  const { t, i18n } = useTranslation();
  const baseLang = (i18n.language || 'en').split('-')[0];
  const { formatPrice } = useCurrency();
  const { profile, isMockMode } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [downloads, setDownloads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!profile?.id) {
        setDownloads([]);
        setIsLoading(false);
        return;
      }
      
      const purchases = await getUserPurchases(profile.id, isMockMode);
      
      if (isMockMode && (!purchases || purchases.length === 0) && profile.purchases) {
        const allProducts = await getPublicProducts(isMockMode);
        const mockPurchased = profile.purchases.map(id => 
          allProducts.find(p => String(p.id) === String(id))
        ).filter(Boolean).map(product => ({ 
          id: `mock-${product.id}`, 
          product, 
          price_paid: product.salePrice || product.price, 
          purchased_at: new Date().toISOString() 
        }));
        setDownloads(mockPurchased);
      } else {
        setDownloads(purchases || []);
      }
      
      setIsLoading(false);
    }
    loadData();
  }, [profile?.purchases, isMockMode, profile?.id]);

  if (isLoading) {
    return (
      <div className="container py-2xl">
        <div className="downloads-header mb-2xl">
          <h1 className="page-title">{t('downloads.title')}</h1>
        </div>
        <div className="products-grid-view">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="download-card glass-card" style={{ height: 360, display: 'flex', flexDirection: 'column' }}>
              <div className="skeleton" style={{ height: '55%', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}></div>
              <div className="download-info" style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '70%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '50%', marginTop: 'var(--space-xs)' }}></div>
                <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginTop: 'auto' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="container py-xl text-center">
        <div className="empty-downloads-icon mx-auto mb-xl">
          <DownloadCloud size={48} className="text-muted" />
        </div>
        <h1 className="page-title mb-md">{t('downloads.empty')}</h1>
        <p className="page-subtitle text-muted mb-2xl">{t('downloads.emptyDesc')}</p>
        <Link to="/marketplace" className="btn btn-primary btn-lg">
          {t('cart.continueShopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-2xl">
      <div className="downloads-header mb-2xl">
        <h1 className="page-title">{t('downloads.title')}</h1>
      </div>

      {downloadError && (
        <div className="mb-lg flex items-start gap-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md) var(--space-lg)' }}>
          <span className="text-sm" style={{ color: '#ef4444' }}>{downloadError}</span>
          <button onClick={() => setDownloadError('')} style={{ marginLeft: 'auto', opacity: 0.6 }}>×</button>
        </div>
      )}

      <div className="products-grid-view">
        {downloads.map(download => {
          const product = download.product;
          
          if (!product) {
            return (
              <div key={download.id} className="download-card glass-card p-xl text-center" style={{ border: '2px dashed var(--color-border)' }}>
                 <div className="flex-center mb-md"><ShoppingBag size={24} className="text-muted" /></div>
                 <h3 className="font-bold mb-xs text-secondary">Product Unavailable</h3>
                 <p className="text-muted text-sm mb-md">This product is no longer available.</p>
                 <span className="text-muted text-sm block mb-md">{t('purchases.purchaseDate')}: {formatDate(download.purchased_at)}</span>
                 <button className="btn btn-primary w-full flex-center gap-sm" disabled>
                   <CloudDownload size={18} /> Unavailable
                 </button>
              </div>
            );
          }

          return (
            <div key={download.id} className="download-card glass-card">
              <div className="download-image-placeholder" style={{ position: 'relative' }}>
                <img src={product.images?.[0] || ''} alt={getLocalizedString(product.title, baseLang)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="download-info">
                <h3 className="download-title line-clamp-2">{getLocalizedString(product.title, baseLang)}</h3>
                <span className="text-muted text-sm">{formatPrice(download.price_paid || product.price)}</span>
                <p className="download-date text-muted">{t('purchases.purchaseDate')}: {formatDate(download.purchased_at)}</p>
                
                <button
                  className="btn btn-primary w-full mt-md flex-center gap-sm"
                  disabled={downloadingId === download.id}
                  onClick={async () => {
                    setDownloadingId(download.id);
                    setDownloadError('');
                    try {
                      const { downloadUrl } = await requestDownloadUrl(product.id);
                      const a = document.createElement('a');
                      a.href = downloadUrl;
                      a.target = '_blank';
                      a.rel = 'noopener noreferrer';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    } catch (err) {
                      if (err.error === 'no_file') {
                        setDownloadError(`"${getLocalizedString(product.title, baseLang)}" — the seller hasn't uploaded a file yet.`);
                      } else {
                        setDownloadError(err.message || 'Download failed. Please try again.');
                      }
                    } finally {
                      setDownloadingId(null);
                    }
                  }}
                >
                  {downloadingId === download.id
                    ? <><span className="loader spin" style={{ width: 16, height: 16, borderWidth: 2 }} /> Preparing…</>
                    : <><CloudDownload size={18} /> {t('downloads.downloadNow')}</>
                  }
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
