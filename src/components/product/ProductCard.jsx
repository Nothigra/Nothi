import { useState } from 'react';
import { Link } from 'react-router';
import { 
  Star, 
  Sliders, 
  MoveRight, 
  Palette, 
  Layers, 
  Music, 
  FolderOpen, 
  Package, 
  Wand2, 
  LayoutTemplate,
  Image as ImageIcon,
  X,
  Rocket
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MOCK_CREATORS } from '../../lib/seed';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { getThumbnailUrl } from '../../utils/mediaHelpers';
import AvatarFrame from '../common/AvatarFrame';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import './ProductCard.css';

const CAT_STYLES = {
  'presets': { var: '--cat-presets', Icon: Sliders },
  'transitions': { var: '--cat-transitions', Icon: MoveRight },
  'luts': { var: '--cat-luts', Icon: Palette },
  'overlays': { var: '--cat-overlays', Icon: Layers },
  'sfx': { var: '--cat-sfx', Icon: Music },
  'project-files': { var: '--cat-project-files', Icon: FolderOpen },
  'editing-packs': { var: '--cat-editing-packs', Icon: Package },
  'motion-graphics': { var: '--cat-motion-graphics', Icon: Wand2 },
  'templates': { var: '--cat-templates', Icon: LayoutTemplate }
};

const SW_STYLES = {
  'After Effects': '--sw-after-effects',
  'Premiere Pro': '--sw-premiere-pro',
  'DaVinci Resolve': '--sw-davinci-resolve',
  'Blender': '--sw-blender',
  'Final Cut Pro': '--sw-final-cut-pro',
  'Lightroom': '--sw-lightroom',
  'CapCut': '--sw-capcut',
  'Photoshop': '--sw-photoshop'
};

export default function ProductCard({ product, cardStyle = {}, onRemove }) {
  const { t, i18n } = useTranslation();
  const { formatPrice } = useCurrency();
  const { profile, isMockMode } = useAuth();
  const [imgError, setImgError] = useState(false);
  
  const catKey = product.category.toLowerCase().replace(' ', '-');
  const catStyle = CAT_STYLES[catKey] || { var: '--color-text-secondary', Icon: ImageIcon };
  const CategoryIcon = catStyle.Icon;
  
  const localizedTitle = getLocalizedString(product.title, (i18n.language || 'en').split('-')[0]);
  const localizedDesc = getLocalizedString(product.description, (i18n.language || 'en').split('-')[0]);

  // Resolve creator name: use provided creatorName, or look up from creator_id
  const creatorName = product.creatorName 
    || product.creator_username
    || MOCK_CREATORS.find(c => c.id === product.creator_id)?.username 
    || 'Unknown';
  
  // Handle both field name conventions (camelCase from enriched data, snake_case from mock data)
  const reviewCount = product.reviews ?? product.reviews_count ?? 0;
  const salePrice = product.salePrice ?? product.sale_price ?? null;

  const isOwner = profile?.id === (product.creator_id || product.seller_id);
  
  const isBoosted = isMockMode
    ? (product.boost && new Date(product.boost.endDate) > new Date())
    : (product.boosted_until && new Date(product.boosted_until) > new Date()) || product.is_boosted;

  const thumbnailUrl = getThumbnailUrl(product);

  return (
    <div className="product-card" style={cardStyle}>
      <Link 
        to={`/product/${product.id}`} 
        state={{ product: product }}
        className="product-card-link-overlay" 
        aria-label={`View ${localizedTitle}`}
        style={{ display: 'block', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, cursor: 'pointer', backgroundColor: 'transparent' }} 
      />
      <div 
        className="product-thumbnail relative" 
        style={{ width: '100%', paddingBottom: '75%', display: 'block', overflow: 'hidden', backgroundColor: 'var(--color-bg-tertiary)', borderBottom: '1px solid var(--color-border)' }}
      >
        {onRemove && (
          <button 
            className="absolute top-sm right-sm w-8 h-8 rounded-full bg-bg-card flex items-center justify-center shadow-md hover:bg-red-50 text-red-500 transition-colors border border-border"
            style={{ zIndex: 10 }}
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              onRemove(product.id); 
            }}
            title="Remove"
            aria-label="Remove"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
        {isOwner && isBoosted && (
          <div 
            className="absolute top-sm left-sm bg-accent text-white px-[8px] py-[2px] rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md flex items-center gap-[4px] z-10"
          >
            <Rocket size={10} /> Boosted
          </div>
        )}
        {thumbnailUrl && !imgError ? (
          <img 
            src={thumbnailUrl} 
            alt={localizedTitle} 
            className="thumbnail-img" 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div 
            className="thumbnail-fallback" 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `color-mix(in srgb, var(${catStyle.var}) 8%, transparent)` }}
          >
            <CategoryIcon size={40} className="fallback-icon" style={{ color: `var(${catStyle.var})`, opacity: 0.25 }} />
          </div>
        )}
        <div 
          className="category-badge" 
          style={{ 
            backgroundColor: `color-mix(in srgb, var(${catStyle.var}) 10%, transparent)`, 
            color: `var(${catStyle.var})` 
          }}
        >
          {t(`categories.${catKey}`, { defaultValue: product.category })}
        </div>
      </div>
      
      <div className="product-content">
        <Link to={`/creator/${creatorName}`} className="product-creator" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AvatarFrame 
            tier={product.tier || 'none'} 
            imageUrl={product.creator_avatar} 
            size="sm" 
            fallbackLetter={creatorName.charAt(0).toUpperCase()} 
          />
          <span className="creator-name" style={{ marginLeft: '4px' }}>{creatorName}</span>
        </Link>
        
        <h3 className="product-title" title={localizedTitle}>
          {localizedTitle}
        </h3>
        
        {localizedDesc && (
          <p className="product-description line-clamp-2 text-sm text-secondary mt-xs mb-sm" title={localizedDesc} style={{ color: 'var(--card-desc-color, var(--color-text-secondary))' }}>
            {localizedDesc}
          </p>
        )}
        

        
        <div className="product-software">
          {product.software && product.software.slice(0, 3).map((soft, index) => {
            const swVar = SW_STYLES[soft] || '--color-text-secondary';
            return (
              <span 
                key={index} 
                className="software-tag"
                style={{
                  backgroundColor: `color-mix(in srgb, var(${swVar}) 8%, transparent)`,
                  color: `var(${swVar})`
                }}
              >
                {soft}
              </span>
            );
          })}
          {product.software && product.software.length > 3 && (
            <span className="software-tag fallback-tag">+{product.software.length - 3}</span>
          )}
        </div>
        
        <div className="product-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="product-price-wrap">
            {salePrice ? (
              <>
                <span className="price-old">{formatPrice(product.price)}</span>
                <span className="price-current">{formatPrice(salePrice)}</span>
              </>
            ) : (
              <span className="price-current">{formatPrice(product.price)}</span>
            )}
          </div>
          <div className="product-rating" style={{ margin: 0 }}>
            <Star size={12} fill="currentColor" className="star-icon" />
            <span>{product.rating}</span>
            <span className="review-count">({reviewCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

