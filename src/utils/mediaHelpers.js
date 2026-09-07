/**
 * Helper to derive the best thumbnail URL from a product object.
 * It handles the unified `media` array (favoring the first image, or a video's posterUrl)
 * and falls back gracefully to the legacy `images` array or `video_url` poster.
 * 
 * @param {Object} product - The product object from the database
 * @returns {string} The URL to the best available thumbnail, or an empty string
 */
export function getThumbnailUrl(product) {
  if (!product) return '';
  
  // 1. Try unified media array
  if (product.media && product.media.length > 0) {
    // Prefer the first image if available, else use video poster
    const firstMedia = product.media[0];
    if (firstMedia.type === 'image') return firstMedia.url;
    if (firstMedia.type === 'video' && firstMedia.posterUrl) return firstMedia.posterUrl;
  }
  
  // 2. Try legacy images array
  if (product.images && product.images.length > 0) {
    return product.images[0];
  }
  
  // 3. Fallback for legacy video-only products (might not have a poster, but we return empty string if not found)
  return '';
}
