import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Heart, ArrowRight } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import ProductCard from '../components/product/ProductCard';
import './WishlistPage.css';

export default function WishlistPage() {
  const { t } = useTranslation();
  const { items, removeFromWishlist } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="container-2xl py-xl text-center">
        <div className="empty-wishlist-icon mx-auto mb-xl">
          <Heart size={48} className="text-muted" />
        </div>
        <h1 className="page-title mb-md">{t('wishlist.empty')}</h1>
        <p className="page-subtitle text-muted mb-2xl">{t('wishlist.emptyDesc')}</p>
        <Link to="/marketplace" className="btn btn-primary btn-lg">
          {t('cart.continueShopping')} <ArrowRight size={20} />
        </Link>
      </div>
    );
  }

  return (
    <div className="container-2xl py-2xl">
      <h1 className="page-title mb-2xl">{t('wishlist.title')}</h1>
      
      <div className="products-grid-view">
        {items.map(product => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onRemove={() => removeFromWishlist(product.id)}
          />
        ))}
      </div>
    </div>
  );
}
