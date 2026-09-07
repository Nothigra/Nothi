import { supabase, withTimeoutSafety } from '../lib/supabase';
import { MOCK_PRODUCTS } from '../lib/seed';

let publicProductsCache = null;
let publicProductsCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutes

export async function getPublicProducts(isMockMode) {
  if (isMockMode) {
    return MOCK_PRODUCTS;
  }
  
  if (publicProductsCache && Date.now() - publicProductsCacheTime < CACHE_TTL) {
    return publicProductsCache;
  }
  
  const { data, error } = await supabase
    .from('public_products')
    .select('*');
    
  if (error) {
    console.error('Error fetching public products:', error);
    return [];
  }
  
  publicProductsCache = data;
  publicProductsCacheTime = Date.now();
  return data;
}

export function invalidateProductCache() {
  publicProductsCache = null;
  publicProductsCacheTime = 0;
}

export async function getProductById(id, isMockMode) {
  if (isMockMode) {
    return MOCK_PRODUCTS.find(p => p.id === id);
  }
  
  const { data, error } = await supabase
    .from('public_products')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) {
    console.error('Error fetching product:', error);
    return null;
  }
  return data;
}

export async function createProduct(productData) {
  console.log("PAYLOAD TO SUPABASE:", productData);
  try {
    const { data, error } = await withTimeoutSafety(() =>
      supabase
        .from('products')
        .insert([productData])
        .select()
        .single()
    );
    console.log("SUPABASE RESPONSE DATA:", data, "ERROR:", error);
      
    if (error) {
      console.error('Error creating product:', error);
      return null;
    }
    
    invalidateProductCache();
    return data;
  } catch (err) {
    console.error('Error creating product:', err);
    return null;
  }
}

export async function updateProduct(id, updates) {
  if (!id) throw new Error('Product ID is required for updates');
  
  try {
    const { data, error } = await withTimeoutSafety(() =>
      supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    );

    if (error) {
      console.error('Error updating product:', error);
      return null;
    }
    
    invalidateProductCache();
    return data;
  } catch (err) {
    console.error('Error updating product:', err);
    return null;
  }
}

/**
 * Requests a presigned PUT URL from the generate-product-file-upload-url Edge Function.
 * Returns { uploadUrl, filePath } on success, or throws on error.
 * Automatically deletes the previous file from R2 if one already exists (server-side cleanup).
 */
export async function requestProductFileUploadUrl({ productId, filename, contentType, fileSize }) {
  const { data, error } = await withTimeoutSafety(() => 
    supabase.functions.invoke('generate-product-file-upload-url', {
      body: { productId, filename, contentType, fileSize }
    })
  );

  if (error) {
    const err = new Error(error.message || 'Failed to get upload URL');
    Object.assign(err, error);
    throw err;
  }
  return data;
}

/**
 * Requests a short-lived (10-minute) presigned GET URL for a purchased product's file.
 * Returns { downloadUrl } on success, or throws with { error, message } on 403/404.
 */
export async function requestDownloadUrl(productId) {
  const { data, error } = await withTimeoutSafety(() =>
    supabase.functions.invoke('generate-download-url', {
      body: { productId }
    })
  );

  if (error) {
    const err = new Error(error.message || 'Download failed');
    Object.assign(err, error);
    // Explicitly copy custom error fields if they were mapped by Supabase (e.g., err.error = 'no_file')
    if (error.context && error.context.json) {
      try {
        const json = await error.context.json();
        Object.assign(err, json);
      } catch (e) {
        // ignore JSON parse errors here
      }
    }
    throw err;
  }
  return data;
}

export async function getProductsByCreator(creatorId, isMockMode) {
  if (isMockMode) {
    return MOCK_PRODUCTS.filter(p => p.creator_id === creatorId);
  }
  
  const { data, error } = await supabase
    .from('public_products')
    .select('*')
    .eq('seller_id', creatorId);
    
  if (error) {
    console.error('Error fetching creator products:', error);
    return [];
  }
  return data;
}

export async function createPurchase(purchaseData, isMockMode) {
  if (isMockMode) {
    return { success: true, data: purchaseData };
  }

  try {
    const { data, error } = await withTimeoutSafety(() =>
      supabase
        .from('purchases')
        .insert([purchaseData])
        .select()
        .single()
    );

    if (error) {
      if (error.code === '23505') {
        // Unique violation - already purchased, treat as success
        return { success: true, data: { already_purchased: true } };
      }
      console.error('Error creating purchase:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error creating purchase (timeout/exception):', error);
    return { success: false, error };
  }
}

export async function getUserPurchases(userId, isMockMode) {
  if (isMockMode) {
    return []; 
  }

  // 1. Fetch ONLY the raw purchase records (RLS allows buyers to read their own purchases)
  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('*')
    .eq('buyer_id', userId)
    .order('purchased_at', { ascending: false });

  if (purchasesError) {
    console.error('Error fetching purchases:', purchasesError);
    return [];
  }

  if (!purchases || purchases.length === 0) {
    return [];
  }

  const productIds = purchases.map(p => p.product_id);
  const sellerIds = [...new Set(purchases.map(p => p.seller_id).filter(Boolean))];

  // 2. Fetch the safe product data and seller profile data concurrently
  const [
    { data: safeProducts, error: productsError },
    { data: safeSellers, error: sellersError }
  ] = await Promise.all([
    supabase
      .from('public_products')
      .select('id, title, price, images, media, category')
      .in('id', productIds),
    supabase
      .from('public_profiles')
      .select('id, username, avatar_url')
      .in('id', sellerIds)
  ]);

  if (productsError) console.error('Error fetching products for purchases:', productsError);
  if (sellersError) console.error('Error fetching sellers for purchases:', sellersError);

  // 3. Stitch everything together securely
  return purchases.map(purchase => ({
    ...purchase,
    product: safeProducts?.find(prod => prod.id === purchase.product_id) || null,
    seller: safeSellers?.find(sel => sel.id === purchase.seller_id) || null
  }));
}

export async function checkHasPurchased(buyerId, productId, isMockMode) {
  if (isMockMode) {
    return false;
  }
  
  if (!buyerId || !productId) return false;

  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('product_id', productId)
      .eq('status', 'completed')
      .maybeSingle();

    if (error) {
      console.error('Error checking purchase status:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Exception checking purchase status:', error);
    return false;
  }
}

// ─── Reviews ────────────────────────────────────────────────────────────────

/**
 * Fetch all reviews for a product, joining reviewer username + avatar.
 */
export async function getReviews(productId) {
  if (!productId) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, updated_at, buyer_id, buyer:public_profiles!buyer_id(username, avatar_url)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
  return data || [];
}

/**
 * Get the current user's own review for a product (null if none).
 */
export async function getUserReviewForProduct(productId, buyerId) {
  if (!productId || !buyerId) return null;
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, updated_at')
    .eq('product_id', productId)
    .eq('buyer_id', buyerId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching own review:', error);
    return null;
  }
  return data;
}

/**
 * Submit or update a review (upsert on unique(product_id, buyer_id)).
 * Wrapped with withTimeoutSafety per project guardrails.
 */
export async function submitReview({ productId, buyerId, rating, comment }) {
  try {
    const { data, error } = await withTimeoutSafety(() =>
      supabase
        .from('reviews')
        .upsert(
          {
            product_id: productId,
            buyer_id: buyerId,
            rating,
            comment: comment || null,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'product_id,buyer_id' }
        )
        .select('id, rating, comment, created_at, updated_at')
        .single()
    );

    if (error) {
      console.error('Error submitting review:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('Review submit exception:', err);
    return { success: false, error: err };
  }
}

/**
 * Gets exact sales count for a given seller by querying purchases.
 */
export async function getSellerSalesCount(sellerId) {
  const { count, error } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .eq('status', 'completed');
    
  if (error) {
    console.error("Error fetching seller sales count:", error);
    return 0;
  }
  return count || 0;
}
