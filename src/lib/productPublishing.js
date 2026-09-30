/**
 * productPublishing.js — the rules and steps for publishing a product, shared
 * by the website form (UploadProductPage) and the app's step-by-step flow
 * (AppPublishPage). Server-side checks remain the source of truth:
 *  - file type / size: generate-product-file-upload-url
 *  - product count per plan: DB trigger
 *  - promotion rule: DB constraint products_sale_price_valid
 */
import { createProduct, requestProductFileUploadUrl, updateProduct } from '../api/productApi';
import { PLAN_LIMITS } from '../config/plans';

export const formatEur = (amount) =>
  new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(amount);

// 0.50 EUR <= sale price < regular price. 0.50 EUR is Stripe's minimum charge.
export const MIN_SALE_PRICE = 0.5;
export const MIN_PAID_PRICE = 0.5;

const pad2 = (n) => String(n).padStart(2, '0');
/** ISO timestamp -> 'YYYY-MM-DD' in the seller's local time (for <input type="date">) */
export const toDateInputValue = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
export const todayInputValue = () => toDateInputValue(new Date().toISOString());

export function validatePromo(form) {
  if (!form.promoEnabled) return '';
  const price = parseFloat(form.price);
  const sale = parseFloat(form.salePrice);
  if (!price || price <= 0) return 'A promotion needs a regular price above 0.';
  if (!sale || Number.isNaN(sale)) return 'Enter the promotional price.';
  if (sale < MIN_SALE_PRICE) return `The promotional price must be at least ${formatEur(MIN_SALE_PRICE)}.`;
  if (sale >= price) return 'The promotional price must be lower than the regular price.';
  if (form.saleEndsAt && form.saleEndsAt < todayInputValue()) return 'The promotion end date is in the past.';
  return '';
}

export function promoPayload(form) {
  if (!form.promoEnabled) return { sale_price: null, sale_ends_at: null };
  return {
    sale_price: Math.round(parseFloat(form.salePrice) * 100) / 100,
    // The promotion runs until the END of the chosen day, in the seller's time zone.
    sale_ends_at: form.saleEndsAt ? new Date(`${form.saleEndsAt}T23:59:59`).toISOString() : null,
  };
}

/** Seller's estimated share for a price in EUR (5% Nothi + ~1.5% + 0.25 € Stripe). */
export function estimateRevenue(priceEur) {
  const price = parseFloat(priceEur);
  if (!price || Number.isNaN(price) || price <= 0) return { gross: 0, commission: 0, stripeFee: 0, net: 0 };
  const cents = Math.round(price * 100);
  const commission = Math.round(cents * 0.05);
  const stripeFee = Math.round(cents * 0.015) + 25;
  const net = Math.max(cents - commission - stripeFee, 0);
  return { gross: cents / 100, commission: commission / 100, stripeFee: stripeFee / 100, net: net / 100 };
}

// Prices must match BOOST_OPTIONS in src/config/plans.js (server: create-boost-checkout)
export const BOOST_PLANS = [
  { id: 'none', days: 0, title: 'No Boost', price: 0, desc: 'Standard marketplace visibility.' },
  { id: '24h', days: 1, title: '24 Hours', price: 2.99, desc: 'Perfect for launching a new product.' },
  { id: '3d', days: 3, title: '3 Days', price: 4.99, desc: 'Great for increasing visibility.' },
  { id: '7d', days: 7, title: '7 Days', price: 6.99, desc: 'Ideal for maximizing exposure.', recommended: true },
];

// Must mirror the server-side allowlist in generate-product-file-upload-url
export const ALLOWED_EXTENSIONS = new Set([
  '.zip', '.rar', '.7z',
  '.aep', '.prproj', '.mogrt', '.drp', '.blend', '.c4d', '.fcpxml',
  '.mp4', '.mov', '.png',
  '.lut', '.cube', '.xmp', '.dng', '.ffx',
]);

/** '' when the file is acceptable, otherwise a readable reason. */
export function checkProductFile(file, { maxFileSizeMB, isProPlan }) {
  if (!file) return 'Choose a file.';
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `“${ext}” files aren't supported. Use ${[...ALLOWED_EXTENSIONS].join(', ')}.`;
  }
  if (file.size > maxFileSizeMB * 1024 * 1024) {
    const limit = maxFileSizeMB >= 1024 ? `${maxFileSizeMB / 1024} GB` : `${maxFileSizeMB} MB`;
    return `This file is too large. The limit is ${limit} on the ${isProPlan ? 'Pro' : 'Free'} plan.`;
  }
  return '';
}

/** PUT to a signed URL with real progress (fetch can't report upload progress). */
export function uploadWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? (onProgress?.(100), resolve())
      : reject(new Error(`File upload failed (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new Error('File upload failed — check your connection and try again.'));
    xhr.send(file);
  });
}

async function uploadProductFile(productId, file, onProgress) {
  const { uploadUrl, filePath } = await requestProductFileUploadUrl({
    productId,
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    fileSize: file.size,
  });
  await uploadWithProgress(uploadUrl, file, onProgress);
  return filePath;
}

/**
 * Create (or update) a product and upload its file.
 *   phase callback: 'creating' | 'uploading' | 'publishing'
 * Returns the product id. Throws with a readable message.
 */
export async function saveProduct({ editingId, draftId, sellerId, payload, productFile, onPhase, onProgress, onDraftCreated }) {
  if (editingId) {
    const updates = { ...payload };
    if (productFile) {
      onPhase?.('uploading');
      updates.file_path = await uploadProductFile(editingId, productFile, onProgress);
    }
    onPhase?.('publishing');
    const updated = await updateProduct(editingId, updates);
    if (!updated) throw new Error('Could not save your changes. Check the price and promotion, then try again.');
    return editingId;
  }

  if (!productFile) throw new Error('A downloadable product file is required before publishing.');
  // draftId: a previous attempt already created the listing (e.g. the upload
  // failed on a bad connection) — reuse it instead of creating a duplicate.
  let id = draftId;
  if (!id) {
    onPhase?.('creating');
    const created = await createProduct({ ...payload, status: 'draft', seller_id: sellerId });
    if (!created) throw new Error('Could not create the product. Please try again.');
    if (created.limitReached) {
      throw new Error(`The Free plan allows ${PLAN_LIMITS.free.maxProducts} products.`);
    }
    id = created.id;
    onDraftCreated?.(id);
  }
  onPhase?.('uploading');
  const filePath = await uploadProductFile(id, productFile, onProgress);
  onPhase?.('publishing');
  const published = await updateProduct(id, { ...payload, file_path: filePath, status: 'published' });
  if (!published) throw new Error('Your file is uploaded but the product could not be published. Please try again.');
  return id;
}
