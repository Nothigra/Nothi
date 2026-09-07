import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { 
  Plus, Search, Edit, Trash2, CheckSquare, Square, 
  Download, Package, ChevronDown, Rocket, 
  TrendingUp, CircleDollarSign, Box
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { getLocalizedString } from '../../utils/i18nHelpers';
import Input from '../../components/ui/Input';
import BoostModal from '../../components/dashboard/BoostModal';
import { getProductsByCreator } from '../../api/productApi';
import { isMockMode } from '../../lib/supabase';
import './DashboardProducts.css';

export default function DashboardProducts() {
  const { profile, updateProfile, isLoading: isAuthLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const { i18n } = useTranslation();
  const baseLang = (i18n.language || 'en').split('-')[0];
  
  const [activeTab, setActiveTab] = useState('All');
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [boostModalProduct, setBoostModalProduct] = useState(null);
  
  const [myProducts, setMyProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Distinct local loading state

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (isAuthLoading) return;
      if (profile?.id) {
        setIsLoading(true);
        if (isMockMode) {
          if (isMounted) setMyProducts(profile.products || []);
        } else {
          const data = await getProductsByCreator(profile.id, false);
          if (isMounted) {
            setMyProducts(data);
          }
        }
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [profile?.id, profile?.products, isAuthLoading]);
  // Calculate quick stats
  const publishedCount = myProducts.filter(p => p.status === 'published' || !p.status).length;
  const draftCount = myProducts.filter(p => p.status === 'draft').length;
  const totalRevenue = myProducts.reduce((sum, p) => sum + (p.revenue || 0), 0) / 100;
  const totalDownloads = myProducts.reduce((sum, p) => sum + (p.sales_count || 0), 0);

  let filteredProducts = activeTab === 'All' 
    ? myProducts 
    : myProducts.filter(p => (p.status || 'published') === activeTab.toLowerCase());

  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p => 
      getLocalizedString(p.title, baseLang).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const handleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const handleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    if (isMockMode) {
      const updated = myProducts.filter(p => p.id !== productId);
      await updateProfile({ products: updated });
    } else {
      const { supabase, withTimeoutSafety } = await import('../../lib/supabase');
      const { error } = await withTimeoutSafety(() => supabase.from('products').delete().eq('id', productId));
      if (error) {
        alert("Failed to delete product.");
        return;
      }
    }
    setMyProducts(myProducts.filter(p => p.id !== productId));
    setSelectedIds(selectedIds.filter(id => id !== productId));
  };

  const handleBoost = async (productId, boostData) => {
    if (profile?.isMockMode) {
      const updated = myProducts.map(p => p.id === productId ? { ...p, boost: boostData } : p);
      await updateProfile({ products: updated });
      return;
    }

    try {
      const { supabase, withTimeoutSafety } = await import('../../lib/supabase');
      const { error } = await withTimeoutSafety(() =>
        supabase
          .from('products')
          .update({ boosted_until: boostData.endDate })
          .eq('id', productId)
      );
        
      if (error) {
        console.error("Boost failed:", error);
        alert("Failed to activate boost.");
      } else {
        // Optimistically update local state
        setMyProducts(myProducts.map(p => p.id === productId ? { ...p, boosted_until: boostData.endDate } : p));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderBoostBadge = (product) => {
    const isBoosted = profile?.isMockMode 
      ? (product.boost && new Date(product.boost.endDate) > new Date())
      : (product.boosted_until && new Date(product.boosted_until) > new Date());
      
    if (!isBoosted) return null;
    
    const now = new Date();
    const endDate = new Date(profile?.isMockMode ? product.boost.endDate : product.boosted_until);
    
    if (endDate > now) {
      const diffMs = endDate - now;
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return (
        <span className="dp-boost-badge ml-xs">
          <Rocket size={10} /> Active ({days}d)
        </span>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-products pb-3xl">
      <div className="dashboard-page-header mb-xl">
        <div>
          <h1 className="dashboard-title">Products</h1>
          <p className="dashboard-subtitle">Manage your digital products and assets.</p>
        </div>
        <div>
          <Link to="/dashboard/upload" className="btn btn-primary flex items-center gap-sm px-lg">
            <Plus size={18} /> New Product
          </Link>
        </div>
      </div>

      {/* Quick Stats Header */}
      {myProducts.length > 0 && (
        <div className="dp-stats-grid">
          <div className="dp-stat-card">
            <div className="dp-stat-header">
              <Box size={16} /> Total Products
            </div>
            <div className="dp-stat-value">{myProducts.length}</div>
          </div>
          <div className="dp-stat-card">
            <div className="dp-stat-header">
              <CheckSquare size={16} /> Published
            </div>
            <div className="dp-stat-value text-success">{publishedCount}</div>
          </div>
          <div className="dp-stat-card">
            <div className="dp-stat-header">
              <TrendingUp size={16} /> Downloads
            </div>
            <div className="dp-stat-value">{totalDownloads}</div>
          </div>
          <div className="dp-stat-card">
            <div className="dp-stat-header">
              <CircleDollarSign size={16} /> Revenue
            </div>
            <div className="dp-stat-value text-accent">{formatPrice(totalRevenue)}</div>
          </div>
        </div>
      )}

      {myProducts.length > 0 ? (
        <>
          <div className="dp-toolbar">
            <div className="dp-tabs">
              {['All', 'Published', 'Draft'].map(tab => (
                <button 
                  key={tab}
                  className={`dp-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div style={{ maxWidth: '300px', width: '100%' }}>
              <Input
                iconLeft={Search}
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                clearable={true}
                onClear={() => setSearchQuery('')}
              />
            </div>
          </div>


          <div className="dp-list">
            {/* Header Row */}
            <div className="flex items-center px-md py-sm text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
              <div 
                className="mr-lg cursor-pointer hover:text-primary transition-colors" 
                onClick={handleSelectAll}
              >
                {selectedIds.length > 0 && selectedIds.length === filteredProducts.length ? <CheckSquare size={18} /> : <Square size={18} />}
              </div>
              <div className="flex-1">Product Details</div>
              <div className="w-[300px] text-right pr-2xl">Performance</div>
            </div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-2xl text-secondary">No products found.</div>
            ) : (
              filteredProducts.map(product => {
                const title = getLocalizedString(product.title, baseLang);
                const isSelected = selectedIds.includes(product.id);
                const status = product.status || 'published';
                
                let thumbnailUrl = 'https://via.placeholder.com/150';
                if (product.media && product.media.length > 0) {
                  const firstMedia = product.media[0];
                  thumbnailUrl = firstMedia.type === 'video' ? (firstMedia.posterUrl || thumbnailUrl) : firstMedia.url;
                } else if (product.images && product.images.length > 0) {
                  thumbnailUrl = product.images[0];
                }

                return (
                  <div key={product.id} className="dp-list-item">
                    <div 
                      className={`dp-item-checkbox ${isSelected ? 'checked' : ''}`} 
                      onClick={() => handleSelect(product.id)}
                    >
                      {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                    </div>

                    <img 
                      src={thumbnailUrl} 
                      alt={title} 
                      className="dp-item-image"
                    />

                    <div className="dp-item-info">
                      <div className="dp-item-title">{title}</div>
                      <div className="dp-item-meta">
                        <span className={`dp-status ${status}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        <span>{formatPrice(product.price)}</span>
                        <span>{product.category}</span>
                        {renderBoostBadge(product)}
                      </div>
                    </div>

                    <div className="dp-item-stats">
                      <div className="dp-stat-group">
                        <span className="label">Downloads</span>
                        <span className="value">{product.sales_count || 0}</span>
                      </div>
                      <div className="dp-stat-group">
                        <span className="label">Revenue</span>
                        <span className="value text-success">{formatPrice((product.revenue || 0) / 100)}</span>
                      </div>
                    </div>

                    <div className="dp-item-actions">
                      <button 
                        className="dp-btn-icon" 
                        title="Boost Product"
                        onClick={() => setBoostModalProduct(product)}
                      >
                        <Rocket size={18} />
                      </button>
                      <Link to={`/dashboard/upload?edit=${product.id}`} state={{ product }}>
                        <button className="dp-btn-icon" title="Edit">
                          <Edit size={18} />
                        </button>
                      </Link>
                      <button 
                        className="dp-btn-icon danger" 
                        title="Delete"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="dp-empty">
          <div className="dp-empty-icon">
            <Package size={32} />
          </div>
          <h3 className="dp-empty-title">No products yet</h3>
          <p className="dp-empty-desc">Create your first product to start selling digital assets to your audience.</p>
          <Link to="/dashboard/upload" className="btn btn-primary inline-flex items-center gap-sm px-xl">
            <Plus size={18} /> Create First Product
          </Link>
        </div>
      )}

      {boostModalProduct && (
        <BoostModal 
          isOpen={!!boostModalProduct} 
          onClose={() => setBoostModalProduct(null)} 
          product={boostModalProduct} 
          onBoost={handleBoost}
        />
      )}
    </div>
  );
}
