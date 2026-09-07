import React from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { getLocalizedString } from '../../utils/i18nHelpers';
import { createPurchase, getProductById } from '../../api/productApi';
import { supabase, isMockMode, invokeFunction, withTimeoutSafety } from '../../lib/supabase';
import { getThumbnailUrl } from '../../utils/mediaHelpers';
import './CartDrawer.css';

export default function CartDrawer() {
  const { t, i18n } = useTranslation();
  const { isCartOpen, closeCart, items, subtotal, removeItem, clearCart } = useCart();
  const { formatPrice } = useCurrency();
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const baseLang = (i18n.language || 'en').split('-')[0];

  const [isCheckingOut, setIsCheckingOut] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState(null);

  const handleCheckout = async () => {
    if (!profile) {
      closeCart();
      navigate('/login');
      return;
    }
    
    setIsCheckingOut(true);
    setCheckoutError(null);
    
    try {
      // Separate free vs paid items
      const freeItems  = items.filter(item => (item.salePrice ?? item.price ?? 0) === 0);
      const paidItems  = items.filter(item => (item.salePrice ?? item.price ?? 0) >  0);

      // ── Free items: direct insert (bypasses Stripe, unaffected by RLS change) ──
      for (const item of freeItems) {
        const freshProduct = await getProductById(item.id, isMockMode);
        if (!freshProduct) throw new Error(t('cart.productUnavailable', 'A product in your cart is no longer available.'));
        await createPurchase({
          buyer_id:   profile.id,
          seller_id:  freshProduct.seller_id || freshProduct.creator_id,
          product_id: freshProduct.id,
          price_paid: 0,
          currency:   'USD',
          is_free:    true,
          status:     'completed'
        }, isMockMode);
      }

      // ── Paid items: redirect to Stripe Checkout ──────────────────────────────
      if (paidItems.length > 0 && !isMockMode) {
        // Hard constraint: Stripe Connect only supports one destination account per
        // Checkout Session. Block carts with paid items from multiple sellers.
        const uniqueSellerIds = new Set(paidItems.map(item => item.seller_id).filter(Boolean));
        if (uniqueSellerIds.size > 1) {
          throw new Error(
            'Your cart contains paid products from multiple creators. ' +
            'Please checkout one creator\'s products at a time.'
          );
        }

        const data = await withTimeoutSafety(() => invokeFunction('create-checkout-session', { productId: paidItems[0].id }));
        if (data?.error) throw new Error(data.error);
        // Don't clear cart — buyer may cancel on Stripe's page.
        // Cart persists in localStorage and will be available if they return.
        closeCart();
        window.location.href = data.url;
        return;
      }

      if (isMockMode) {
        const currentPurchases = profile.purchases || [];
        const newPurchases = items.map(item => item.id);
        const uniquePurchases = Array.from(new Set([...currentPurchases, ...newPurchases]));
        await updateProfile({ purchases: uniquePurchases });
      }

      clearCart();
      closeCart();
      navigate('/dashboard/purchases');
    } catch (err) {
      console.error('Checkout error:', err);
      const msg = err.message || '';
      if (msg.includes('seller_not_connected')) {
        setCheckoutError('A creator in your cart hasn\'t connected their Stripe account yet.');
      } else if (msg.includes('seller_not_ready')) {
        setCheckoutError('A creator\'s Stripe account isn\'t fully verified yet. Try again later.');
      } else {
        setCheckoutError(msg || t('cart.checkoutFailed', 'Failed to complete checkout.'));
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="cart-drawer-overlay" onClick={closeCart}>
          <motion.div 
            className="cart-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cart-drawer-header">
              <h2>
                <ShoppingBag size={20} />
                {t('cart.title', 'Your Cart')}
              </h2>
              <button className="btn-icon" onClick={closeCart}>
                <X size={20} />
              </button>
            </div>

            <div className="cart-drawer-content">
              {items.length === 0 ? (
                <div className="cart-drawer-empty">
                  <ShoppingBag size={48} className="text-muted" style={{ opacity: 0.5 }} />
                  <h3>{t('cart.empty', 'Your cart is empty')}</h3>
                  <p className="text-muted text-sm">{t('cart.emptyDesc', 'Looks like you haven\'t added anything yet.')}</p>
                  <button className="btn btn-primary mt-sm" onClick={closeCart}>
                    {t('cart.continueShopping', 'Continue Shopping')}
                  </button>
                </div>
              ) : (
                items.map(item => (
                  <div key={item.id} className="cart-drawer-item">
                    <img 
                      src={getThumbnailUrl(item) || item.image || `https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&h=150&fit=crop&q=80&sig=${item.id}`} 
                      alt={getLocalizedString(item.title, baseLang)} 
                      className="cart-drawer-item-img"
                    />
                    <div className="cart-drawer-item-info">
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Link 
                            to={`/product/${item.id}`} 
                            className="cart-drawer-item-title"
                            onClick={closeCart}
                          >
                            {getLocalizedString(item.title, baseLang)}
                          </Link>
                          <button 
                            className="btn-icon" 
                            style={{ padding: '4px', marginLeft: '8px', color: 'var(--color-danger, #ef4444)' }}
                            onClick={() => removeItem(item.id)}
                            aria-label={t('cart.remove', 'Remove')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="cart-drawer-item-price">
                        {formatPrice(item.price)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="cart-drawer-footer">
                <div className="cart-drawer-summary-row">
                  <span>{t('cart.subtotal', 'Subtotal')}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {checkoutError && (
                  <div className="text-danger text-sm mb-sm text-center">
                    {checkoutError}
                  </div>
                )}
                <button 
                  className="btn btn-primary btn-block" 
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="loader spin" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                      {t('cart.processing', 'Processing...')}
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {t('cart.checkout', 'Checkout')} <ArrowRight size={18} />
                    </span>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
