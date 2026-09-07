import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { 
  Upload, Plus, Info, Check, Image as ImageIcon, File, Video, 
  AlertCircle, X, Type, Tag, Globe, Settings, ExternalLink, CheckCircle2, Eye, ChevronDown, Rocket, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { CATEGORIES, SOFTWARE_LIST, STYLE_LIST } from '../../lib/seed';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import CurrencyInput from '../../components/ui/CurrencyInput';
import Select from '../../components/ui/Select';
import Checkbox from '../../components/ui/Checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { createProduct, requestProductFileUploadUrl, updateProduct } from '../../api/productApi';
import { supabase } from '../../lib/supabase';
import MediaUploader from '../../components/upload/MediaUploader';

import { useTranslation } from 'react-i18next';
import { languages } from '../../config/i18n';
import { useGamification } from '../../context/GamificationContext';
import './UploadProductPage.css';

const BOOST_PLANS = [
  { id: 'none', days: 0, title: 'No Boost', price: 0, desc: 'Standard marketplace visibility.' },
  { id: '24h', days: 1, title: '24 Hours', price: 2.99, desc: 'Perfect for launching a new product.' },
  { id: '3d', days: 3, title: '3 Days', price: 4.99, desc: 'Great for increasing visibility.' },
  { id: '7d', days: 7, title: '7 Days', price: 6.99, desc: 'Ideal for maximizing exposure.', recommended: true }
];

export default function UploadProductPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, updateProfile, isMockMode } = useAuth();
  const { currency, changeCurrency, formatPrice } = useCurrency();
  const { refreshState } = useGamification();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const [revenue, setRevenue] = useState({ gross: 0, commission: 0, stripeFee: 0, net: 0 });
  const [selectedBoost, setSelectedBoost] = useState('none');
  const [isBoostExpanded, setIsBoostExpanded] = useState(false);
  
  const { i18n } = useTranslation();
  const baseLang = (i18n.language || 'en').split('-')[0];

  const searchParams = new URLSearchParams(location.search);
  const isEditing = searchParams.has('edit');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: CATEGORIES[0].id,
    software: [],
    style: [],
    videoUrl: '',
    visibility: 'public'
  });

  const thumbnailInputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaError, setMediaError] = useState('');
  
  const [productFile, setProductFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [fileUploadProgress, setFileUploadProgress] = useState(0); // 0–100

  // Plan-gated size limits — 'premium' gets 5 GB, free tier gets 500 MB.
  // NOTE: 'pro' was a bug in the previous code — the schema stores 'premium'.
  const IS_PREMIUM = profile?.plan === 'premium';
  const MAX_FILE_SIZE_MB = IS_PREMIUM ? 5120 : 500;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  useEffect(() => {
    if (isEditing && location.state?.product) {
      const p = location.state.product;
      setFormData(prev => ({
        ...prev,
        title: p.title || '',
        description: p.description || '',
        price: p.price !== undefined && p.price !== null ? p.price.toString() : '',
        category: p.category || CATEGORIES[0].id,
        software: p.software || [],
        style: p.style || [],
        features: p.features || [],
        tags: p.tags ? (Array.isArray(p.tags) ? p.tags.join(', ') : p.tags) : '',
        visibility: p.visibility || 'public',
        videoUrl: p.videoUrl || ''
      }));
      
      // Hydrate media items
      if (p.media && Array.isArray(p.media)) {
        setMediaItems(p.media.map(m => ({
          ...m,
          id: Math.random().toString(36).substring(7),
          isUploading: false
        })));
      } else if (p.thumbnailUrl) {
        // Fallback for older format
        setMediaItems([{
          id: Math.random().toString(36).substring(7),
          type: 'image',
          url: p.thumbnailUrl,
          isUploading: false
        }]);
      }
    }
  }, [isEditing, location.state]);

  // Extension allowlist — must mirror the server-side set in generate-product-file-upload-url
  const ALLOWED_EXTENSIONS = new Set([
    '.zip', '.rar', '.7z',
    '.aep', '.prproj', '.mogrt', '.drp', '.blend', '.c4d', '.fcpxml',
    '.mp4', '.mov', '.png',
    '.lut', '.cube', '.xmp', '.dng', '.ffx',
  ]);

  useEffect(() => {
    const price = parseFloat(formData.price);
    if (!price || isNaN(price) || price <= 0) {
      setRevenue({ gross: 0, commission: 0, stripeFee: 0, net: 0 });
      return;
    }

    const priceInCents = Math.round(price * 100);
    const commission = Math.round(priceInCents * 0.05); // 5% platform fee
    const stripeFee = Math.round(priceInCents * 0.015) + 25; // ~1.5% + 0.25 fixed fee estimate
    const net = Math.max(priceInCents - commission - stripeFee, 0);

    setRevenue({
      gross: priceInCents / 100,
      commission: commission / 100,
      stripeFee: stripeFee / 100,
      net: net / 100
    });
  }, [formData.price]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePriceChange = (e) => {
    let newPrice = e.target.value;
    if (newPrice !== '' && Number(newPrice) < 0) newPrice = '0';
    setFormData({...formData, price: newPrice});
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFileError('');
    setFileUploadProgress(0);
    
    if (file) {
      // Client-side extension check (mirrors server allowlist)
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        setFileError(`File type '${ext}' is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`);
        setProductFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const limitLabel = MAX_FILE_SIZE_MB >= 1024 ? `${MAX_FILE_SIZE_MB / 1024} GB` : `${MAX_FILE_SIZE_MB} MB`;
        setFileError(`File is too large. Maximum size is ${limitLabel} for your ${IS_PREMIUM ? 'Premium' : 'Free'} plan.`);
        setProductFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setProductFile(file);
    }
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setProductFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canPublish) {
      setShowValidationErrors(true);
      setPublishError("Please fill in all missing areas highlighted in red, including Category, Software, and Style.");
      return;
    }
    if (fileError) return;
    
    // Enforce mandatory product file for publishing (bypass if editing since they already have one)
    if (!productFile && !isMockMode && !isEditing) {
      setFileError('A downloadable product file is required before publishing.');
      return;
    }
    
    setIsSubmitting(true);
    setPublishError('');

    const baseTitle = formData.title || 'Untitled Product';
    const baseDesc = formData.description || '';
    const validMedia = mediaItems.filter(i => !i.isUploading && i.url);

    const productPayload = {
      title: baseTitle,
      description: baseDesc,
      price: parseFloat(formData.price) || 0,
      category: formData.category,
      media: validMedia.map((m, idx) => ({ type: m.type, url: m.url, posterUrl: m.posterUrl, order: idx })),
      software: formData.software,
      style: formData.style
    };

    if (isMockMode) {
      setTimeout(async () => {
        const currentProducts = profile?.products || [];
        if (isEditing) {
          const updated = currentProducts.map(p => p.id === location.state.product.id ? { ...p, ...productPayload } : p);
          await updateProfile({ products: updated });
        } else {
          const mockProduct = {
            ...productPayload,
            status: 'published',
            id: 'prod-' + Date.now(),
            creator_id: profile?.id,
            sales_count: 0,
            revenue: 0,
            created_at: new Date().toISOString()
          };
          await updateProfile({ products: [mockProduct, ...currentProducts] });
        }
        navigate('/dashboard/products');
      }, 800);
      return;
    }

    try {
      if (isEditing) {
        // === UPDATE EXISTING PRODUCT FLOW ===
        const productId = location.state.product.id;
        
        if (productFile) {
          // User chose to upload a new file during edit
          setIsFileUploading(true);
          setFileUploadProgress(0);
          
          const { uploadUrl, filePath } = await requestProductFileUploadUrl({
            productId,
            filename: productFile.name,
            contentType: productFile.type || 'application/octet-stream',
            fileSize: productFile.size,
          });
          
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': productFile.type || 'application/octet-stream' },
            body: productFile,
          });
          
          if (!uploadRes.ok) throw new Error(`File upload failed (HTTP ${uploadRes.status})`);
          setFileUploadProgress(100);
          
          productPayload.file_path = filePath;
          setIsFileUploading(false);
        }
        
        // Update product metadata (and new file_path if applicable)
        await updateProduct(productId, productPayload);
        
      } else {
        // === CREATE NEW PRODUCT FLOW ===
        productPayload.status = 'draft';
        productPayload.seller_id = profile?.id;
        
        const res = await createProduct(productPayload);
        if (!res) throw new Error('Failed to create product record.');
        
        // Upload the required file
        setIsFileUploading(true);
        setFileUploadProgress(0);
        
        const { uploadUrl, filePath } = await requestProductFileUploadUrl({
          productId: res.id,
          filename: productFile.name,
          contentType: productFile.type || 'application/octet-stream',
          fileSize: productFile.size,
        });
        
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': productFile.type || 'application/octet-stream' },
          body: productFile,
        });
        
        if (!uploadRes.ok) throw new Error(`File upload failed (HTTP ${uploadRes.status})`);
        setFileUploadProgress(100);
        
        // Publish it
        await updateProduct(res.id, { file_path: filePath, status: 'published' });
        setIsFileUploading(false);
        
        // Refresh XP gamification state
        refreshState();
      }
      
      navigate('/dashboard/products');
    } catch (err) {
      console.error('Publish error:', err);
      setPublishError(err.message || 'An unexpected error occurred while saving.');
      setIsFileUploading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasGeneral = formData.title.length > 2 && 
                     formData.description.length > 0 &&
                     formData.category &&
                     formData.software.length > 0 &&
                     formData.style.length > 0;
  const hasMedia = mediaItems.some(i => !i.isUploading && i.url);
  const hasFiles = !!productFile || isEditing;
  const hasPricing = formData.price !== '';
  const canPublish = hasGeneral && hasMedia && hasFiles && hasPricing && !isSubmitting && !isFileUploading;
  
  const currentStep = hasGeneral ? (hasMedia ? (hasFiles ? (hasPricing ? 5 : 4) : 3) : 2) : 1;

  return (
    <div className="dashboard-page pb-3xl">
      {/* Page Header */}
      <div className="dashboard-page-header mb-xl">
        <div>
          <h1 className="dashboard-title">{isEditing ? 'Edit Product' : 'Publish New Product'}</h1>
          <p className="dashboard-subtitle">Create a professional listing to start selling.</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="up-progress hidden md:flex">
        <div className={`up-step ${hasGeneral ? 'completed' : 'active'}`}>
          <div className="up-step-dot">{hasGeneral ? <Check size={14} /> : 1}</div>
          <span className="up-step-label">General</span>
        </div>
        <div className={`up-step ${hasMedia ? 'completed' : (currentStep === 2 ? 'active' : '')}`}>
          <div className="up-step-dot">{hasMedia ? <Check size={14} /> : 2}</div>
          <span className="up-step-label">Media</span>
        </div>
        <div className={`up-step ${hasFiles ? 'completed' : (currentStep === 3 ? 'active' : '')}`}>
          <div className="up-step-dot">{hasFiles ? <Check size={14} /> : 3}</div>
          <span className="up-step-label">Files</span>
        </div>
        <div className={`up-step ${hasPricing ? 'completed' : (currentStep === 4 ? 'active' : '')}`}>
          <div className="up-step-dot">{hasPricing ? <Check size={14} /> : 4}</div>
          <span className="up-step-label">Pricing</span>
        </div>
        <div className={`up-step ${currentStep === 5 ? 'active' : ''}`}>
          <div className="up-step-dot">5</div>
          <span className="up-step-label">Publish</span>
        </div>
      </div>

      <form className="max-w-3xl mx-auto flex flex-col gap-xl" onSubmit={handleSubmit} noValidate>
        
        {/* ─── SECTION 1: General Information ─── */}
        <div className="up-section">
          <div className="up-section-header">
            <div className="up-section-icon"><Type size={16} /></div>
            <h3>General Information</h3>
          </div>

          <div className="up-field">
            <Input
              type="text"
              name="title"
              placeholder="Product Title (e.g. Ultimate UI Kit 2026) *"
              value={formData.title || ''}
              onChange={handleChange}
              error={showValidationErrors && formData.title.length <= 2 ? "Title needs at least 3 characters" : null}
              required
            />
          </div>

          <div className="up-field">
            <div className="flex justify-end mb-xs">
              <span className="text-xs text-secondary">Descriptions over 150 words convert 20% better.</span>
            </div>
            <Textarea
              name="description"
              minRows={8}
              placeholder="Bio / Description * (What's included? Who is it for?)"
              value={formData.description || ''}
              onChange={handleChange}
              error={showValidationErrors && formData.description.length === 0 ? "Description is required" : null}
              required
            />
          </div>

          <div className="up-field">
            <div style={{ maxWidth: 360 }}>
              <CurrencyInput 
                name="price"
                min="0"
                currency={currency}
                onCurrencyChange={changeCurrency}
                placeholder="Product Price *"
                value={formData.price}
                onChange={handlePriceChange}
                required
              />
            </div>

            {revenue.gross > 0 && (
              <div className="up-revenue mt-md" style={{ maxWidth: 360 }}>
                <div className="up-revenue-row text-sm text-secondary">
                  <span>Platform fee (5%):</span>
                  <span className="text-danger">-{formatPrice(revenue.commission)}</span>
                </div>
                <div className="up-revenue-row text-sm text-secondary">
                  <span>Estimated Stripe fee (~1.5% + €0.25):</span>
                  <span className="text-danger">-{formatPrice(revenue.stripeFee)}</span>
                </div>
                <div className="up-revenue-row total mt-xs pt-xs border-t border-border">
                  <span className="font-bold text-primary">You'll receive approximately:</span>
                  <span className="text-success font-bold">{formatPrice(revenue.net)}</span>
                </div>
                
                <p className="mt-sm text-xs text-tertiary leading-relaxed">
                  *Note: This is an estimate. Exact Stripe fees are confirmed at the time of purchase and may vary slightly by the buyer's card type and country.
                </p>

                {revenue.net <= 0 && (
                  <div className="mt-sm flex items-start gap-xs text-xs text-danger">
                    <AlertCircle size={14} className="shrink-0 mt-xs" />
                    <p>Price is too low to cover fixed transaction fees. Please increase.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="up-field">
            <Select
              value={formData.category}
              onChange={(val) => setFormData({...formData, category: val})}
              options={CATEGORIES.map(c => ({ value: c.id, label: c.name }))}
              placeholder="Select Category *"
              searchable={true}
              error={showValidationErrors && !formData.category ? "Category is required" : null}
            />
          </div>

          <div className="up-field">
            <div className="up-field-label">Software Compatibility</div>
            <Select
              multiple={true}
              searchable={true}
              value={formData.software}
              onChange={(val) => setFormData({...formData, software: val})}
              options={SOFTWARE_LIST.map(sw => ({ value: sw, label: sw }))}
              placeholder="Select software tools..."
              error={showValidationErrors && formData.software.length === 0 ? "Software is required" : null}
            />
          </div>

          <div className="up-field">
            <div className="up-field-label">Style of Editing</div>
            <Select
              multiple={true}
              searchable={true}
              value={formData.style}
              onChange={(val) => setFormData({...formData, style: val})}
              options={STYLE_LIST.map(st => ({ value: st, label: st }))}
              placeholder="Select editing styles..."
              error={showValidationErrors && formData.style.length === 0 ? "Style is required" : null}
            />
          </div>
        </div>

        {/* ─── SECTION 2: Media & Assets ─── */}
        <div className="up-section">
          <div className="up-section-header">
            <div className="up-section-icon"><ImageIcon size={16} /></div>
            <h3>Media & Assets</h3>
          </div>
          <div className="up-field">
            <div className="up-field-label">Gallery Images & Videos</div>
            <MediaUploader mediaItems={mediaItems} setMediaItems={setMediaItems} />
            {mediaError && <p className="text-sm text-danger mt-sm font-medium flex items-center gap-xs"><AlertCircle size={14}/> {mediaError}</p>}
          </div>

          {/* Product File Upload */}
          <div className="up-field">
            <div className="up-field-label">
              Product File <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(The asset they buy)</span>
            </div>
            
            <div 
              className={`up-dropzone ${productFile ? 'has-file' : ''} ${fileError ? 'has-error' : ''}`}
              onClick={() => !productFile && fileInputRef.current?.click()}
            >
              {productFile ? (
                <div className="up-file-info">
                  <div className="up-file-check">
                    <Check size={28} />
                  </div>
                  <p className="up-dropzone-title" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productFile.name}</p>
                  <p className="up-dropzone-sub mt-xs">{(productFile.size / (1024 * 1024)).toFixed(2)} MB</p>

                  <button 
                    type="button"
                    className="up-remove-btn"
                    onClick={removeFile}
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="up-dropzone-icon">
                    <File size={24} />
                  </div>
                  <p className="up-dropzone-title">Upload your digital product</p>
                  <p className="up-dropzone-sub">.ZIP, .MP4, .CUBE, .AEP, etc.</p>
                </>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </div>
            {fileError && <p className="text-sm text-danger mt-sm font-medium flex items-center gap-xs"><AlertCircle size={14}/> {fileError}</p>}
            
            <div className="flex justify-between items-center mt-sm">
              <span className="text-xs text-secondary font-medium">
                Max {IS_PREMIUM ? '5 GB' : '500 MB'} &mdash; {IS_PREMIUM ? 'Premium' : 'Free'} plan
              </span>
              {!IS_PREMIUM && (
                <span className="text-xs text-accent opacity-80 hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-xs">
                  <Globe size={12} /> Upgrade to Premium for 5 GB uploads
                </span>
              )}
            </div>
            {isFileUploading && fileUploadProgress > 0 && fileUploadProgress < 100 && (
              <div className="mt-sm">
                <div className="flex justify-between text-xs text-secondary mb-xs">
                  <span>Uploading file...</span>
                  <span>{fileUploadProgress}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-bg-secondary)' }}>
                  <div style={{ height: '100%', width: `${fileUploadProgress}%`, borderRadius: 2, background: 'var(--color-primary)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}
            </div>
          </div>

        {/* ─── SECTION 3: Boost Visibility ─── */}
        <div className="up-section">
          <div 
            className="up-section-header" 
            style={{ cursor: 'pointer', borderBottom: isBoostExpanded ? '1px solid var(--color-border)' : 'none', paddingBottom: isBoostExpanded ? '16px' : '0', marginBottom: isBoostExpanded ? '24px' : '0' }}
            onClick={() => setIsBoostExpanded(!isBoostExpanded)}
          >
            <div className="flex items-center gap-sm flex-1">
              <div className="up-section-icon"><Rocket size={16} /></div>
              <div className="flex flex-col">
                <h3>Boost Visibility</h3>
                <span className="text-xs text-secondary mt-[2px] font-normal">Optional • Increase marketplace exposure</span>
              </div>
            </div>
            <ChevronDown 
              size={20} 
              className="text-secondary" 
              style={{ transform: isBoostExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} 
            />
          </div>
          
          <AnimatePresence>
            {isBoostExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="pt-xs">
                  <div className="up-boost-grid">
                    {BOOST_PLANS.map(plan => {
                      const isSelected = selectedBoost === plan.id;
                      return (
                        <div 
                          key={plan.id}
                          className={`up-boost-card ${isSelected ? 'selected' : ''} ${plan.recommended ? 'recommended' : ''}`}
                          onClick={() => setSelectedBoost(plan.id)}
                        >
                          {plan.recommended && <div className="up-boost-badge">Recommended</div>}
                          <div className="up-boost-radio">
                            <div className="radio-inner"></div>
                          </div>
                          <div className="up-boost-content">
                            <h4 className="up-boost-title">{plan.title}</h4>
                            <p className="up-boost-desc">{plan.desc}</p>
                          </div>
                          <div className="up-boost-price">
                            {plan.price === 0 ? 'Free' : formatPrice(plan.price)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Footer Actions ─── */}
        <div className="up-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {publishError && (
              <span className="text-danger text-sm font-medium flex items-center gap-xs">
                <AlertCircle size={16} /> {publishError}
              </span>
            )}
          </div>
          <button 
            type="submit" 
            className="btn btn-primary btn-lg min-w-[200px]" 
            disabled={isSubmitting || isFileUploading}
            style={!canPublish ? { filter: 'grayscale(100%)', opacity: 0.7, cursor: 'pointer' } : {}}
          >
            {isFileUploading
              ? 'Uploading file…'
              : isSubmitting
              ? 'Publishing…'
              : selectedBoost === 'none'
              ? 'Publish Product'
              : `Publish & Pay ${formatPrice(BOOST_PLANS.find(p => p.id === selectedBoost).price)}`
            }
          </button>
        </div>
      </form>
    </div>
  );
}
