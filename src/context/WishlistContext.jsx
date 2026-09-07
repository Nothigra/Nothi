import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as store from '../lib/accountStore';

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const { profile, isAuthenticated, updateProfile, isMockMode } = useAuth();

  const [collections, setCollections] = useState([
    { id: 'default', name: 'Saved Items', isPublic: false, items: [] }
  ]);

  // Sync collections from account on login/profile change
  useEffect(() => {
    if (isAuthenticated && profile?.wishlist_collections) {
      setCollections(profile.wishlist_collections);
    } else if (!isAuthenticated) {
      setCollections([{ id: 'default', name: 'Saved Items', isPublic: false, items: [] }]);
    }
  }, [isAuthenticated, profile?.id]); // re-run when account switches

  const persistCollections = useCallback((newCollections) => {
    setCollections(newCollections);
    if (isAuthenticated && isMockMode) {
      // Persist directly to account store for instant save
      const sessionId = store.getSession();
      if (sessionId) {
        store.updateAccount(sessionId, { wishlist_collections: newCollections });
      }
    }
  }, [isAuthenticated, isMockMode]);

  // Legacy single-wishlist toggle (adds to/removes from default collection)
  const toggleWishlist = (product) => {
    const newCols = collections.map(c => ({ ...c, items: [...c.items] }));
    const defaultCol = newCols[0];
    const exists = defaultCol.items.find(item => item.id === product.id);
    
    if (exists) {
      defaultCol.items = defaultCol.items.filter(item => item.id !== product.id);
    } else {
      defaultCol.items.push(product);
    }
    
    persistCollections(newCols);
  };

  const isInWishlist = (productId) => collections.some(col => col.items.some(item => item.id === productId));

  const createCollection = (name, isPublic = false) => {
    const newCol = { id: Date.now().toString(), name, isPublic, items: [] };
    persistCollections([...collections, newCol]);
  };

  const deleteCollection = (id) => {
    if (id === 'default') return;
    persistCollections(collections.filter(c => c.id !== id));
  };

  const updateCollection = (id, updates) => {
    persistCollections(collections.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addItemToCollection = (collectionId, product) => {
    persistCollections(collections.map(c => {
      if (c.id === collectionId && !c.items.some(i => i.id === product.id)) {
        return { ...c, items: [...c.items, product] };
      }
      return c;
    }));
  };

  const removeItemFromCollection = (collectionId, productId) => {
    persistCollections(collections.map(c => {
      if (c.id === collectionId) {
        return { ...c, items: c.items.filter(i => i.id !== productId) };
      }
      return c;
    }));
  };

  const moveItem = (fromColId, toColId, product) => {
    let newCols = collections.map(c => ({ ...c, items: [...c.items] }));
    newCols = newCols.map(c => c.id === fromColId ? { ...c, items: c.items.filter(i => i.id !== product.id) } : c);
    newCols = newCols.map(c => {
      if (c.id === toColId && !c.items.some(i => i.id === product.id)) {
        return { ...c, items: [...c.items, product] };
      }
      return c;
    });
    persistCollections(newCols);
  };

  const removeFromWishlist = (productId) => {
    persistCollections(collections.map(c => ({
      ...c,
      items: c.items.filter(i => i.id !== productId)
    })));
  };

  const allItems = collections.flatMap(c => c.items);
  const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());

  return (
    <WishlistContext.Provider value={{ 
      collections, 
      items: uniqueItems,
      toggleWishlist,
      isInWishlist,
      createCollection,
      deleteCollection,
      updateCollection,
      addItemToCollection,
      removeItemFromCollection,
      removeFromWishlist,
      moveItem
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
}

export default WishlistContext;
