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
    // thumbUrl = small WebP generated at upload (fast lists); fall back to the original
    const firstMedia = product.media[0];
    if (firstMedia.type === 'image') return firstMedia.thumbUrl || firstMedia.url;
    if (firstMedia.type === 'video' && (firstMedia.thumbUrl || firstMedia.posterUrl)) return firstMedia.thumbUrl || firstMedia.posterUrl;
  }
  
  // 2. Try legacy images array
  if (product.images && product.images.length > 0) {
    return product.images[0];
  }
  
  // 3. Fallback for legacy video-only products (might not have a poster, but we return empty string if not found)
  return '';
}

/**
 * Shrinks a picture before it is uploaded (profile photos, shop banners).
 * A phone photo is several megabytes and thousands of pixels wide; shown at
 * 24–160px it made every list that displays it slow to scroll.
 * Returns the original file when it is already small or cannot be read.
 */
export async function shrinkImage(file, maxSide = 512, quality = 0.85) {
  try {
    if (!file?.type?.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 300 * 1024) { bitmap.close?.(); return file; }
    const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    let blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = (file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}
