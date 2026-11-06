import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isMockMode } from '../lib/supabase';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('digilab-cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { user } = useAuth();

  // Products already owned (bought on another tab or device, or the payment
  // came back to another page) never stay in the cart.
  const cartKey = items.map(i => i.id).join(',');
  useEffect(() => {
    if (isMockMode || !user?.id || !cartKey) return undefined;
    let cancelled = false;
    supabase.from('purchases').select('product_id').eq('buyer_id', user.id).in('product_id', cartKey.split(','))
      .then(({ data }) => {
        if (cancelled || !data?.length) return;
        const owned = new Set(data.map(r => r.product_id));
        setItems(prev => prev.filter(item => !owned.has(item.id)));
      });
    return () => { cancelled = true; };
  }, [user?.id, cartKey, isCartOpen]);
  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  useEffect(() => {
    localStorage.setItem('digilab-cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product) => {
    setItems(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) return prev;
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeItem = (productId) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    setItems(prev => prev.map(item =>
      item.id === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => {
    setItems([]);
  };

  // Products sent to Stripe Checkout: removed from the cart only once the
  // payment succeeded (see completePendingCheckout on the success page).
  const PENDING_KEY = 'nothi-pending-checkout';
  const rememberPendingCheckout = (productIds) => {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(productIds || [])); } catch { /* ignore */ }
  };
  const completePendingCheckout = () => {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { ids = []; }
    try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
    if (Array.isArray(ids) && ids.length) {
      setItems(prev => prev.filter(item => !ids.includes(item.id)));
    }
  };

  const isInCart = (productId) => {
    return items.some(item => item.id === productId);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  // Promotion price when the product was added during an active sale.
  // (Display only — the server always charges the live price at checkout.)
  const subtotal = items.reduce((sum, item) => sum + (Number(item.salePrice ?? item.sale_price ?? item.price) * item.quantity), 0);
  const total = subtotal; // Can add tax/discount logic later

  return (
    <CartContext.Provider value={{
      items,
      itemCount,
      subtotal,
      total,
      rememberPendingCheckout,
      completePendingCheckout,
      isCartOpen,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isInCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}

export default CartContext;
