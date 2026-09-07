import React, { useRef, useEffect } from 'react';
import { User, Search, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../context/CurrencyContext';
import { getLocalizedString } from '../../utils/i18nHelpers';
import './SearchDropdown.css';

const SearchDropdown = ({ query, debouncedQuery, results, isVisible, onClose }) => {
  const { i18n, t } = useTranslation();
  const { formatPrice } = useCurrency();
  const dropdownRef = useRef(null);

  const baseLang = i18n.language.split('-')[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, onClose]);

  if (!isVisible || query.trim() === '') return null;

  const isSearching = query !== debouncedQuery;

  return (
    <div className="search-dropdown-container card-elevated" ref={dropdownRef}>
      {isSearching ? (
        <div className="search-dropdown-empty">
          <Loader2 className="spin text-muted" size={24} />
          <span className="text-sm text-secondary">Searching...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="search-dropdown-empty">
          <Search className="text-muted mb-xs" size={24} />
          <span className="text-sm text-secondary">No results found for "{debouncedQuery}"</span>
        </div>
      ) : (
        <div className="search-dropdown-list">
          {results.map((item, index) => {
            if (item.type === 'product') {
              const product = item.data;
              const title = getLocalizedString(product.title, baseLang);
              const price = product.salePrice || product.sale_price || product.price;
              
              return (
                <Link 
                  key={`product-${product.id}-${index}`} 
                  to={`/product/${product.id}`}
                  className="search-dropdown-item"
                  onClick={onClose}
                >
                  <div className="search-item-thumb">
                    {product.images && product.images[0] ? (
                      <img src={product.images[0]} alt={title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-bg-tertiary flex items-center justify-center text-xs text-muted">Img</div>
                    )}
                  </div>
                  <div className="search-item-content">
                    <span className="search-item-title line-clamp-1">{title}</span>
                    <span className="search-item-meta font-bold text-text-primary">{formatPrice(price)}</span>
                  </div>
                </Link>
              );
            } else {
              const seller = item.data;
              return (
                <Link 
                  key={`seller-${seller.id}-${index}`} 
                  to={`/creator/${seller.username}`}
                  className="search-dropdown-item seller-item"
                  onClick={onClose}
                >
                  <div className="search-item-thumb seller-thumb">
                    {seller.avatar ? (
                      <img src={seller.avatar} alt={seller.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full bg-accent-subtle text-accent flex items-center justify-center rounded-full">
                        <User size={18} />
                      </div>
                    )}
                  </div>
                  <div className="search-item-content">
                    <span className="search-item-title line-clamp-1 flex items-center gap-xs">
                      {seller.name}
                      <span className="text-xs font-normal text-secondary bg-bg-secondary px-1 rounded">Seller</span>
                    </span>
                    <span className="search-item-meta">@{seller.username}</span>
                  </div>
                </Link>
              );
            }
          })}
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;
