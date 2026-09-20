import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate, useBlocker } from 'react-router';
import { Star, CheckCircle2, LayoutDashboard, Edit2, Camera, Upload, Check, X, GripVertical, Plus, Settings, Eye, EyeOff, Loader2, ArrowLeft, UserPlus, Flag, Palette } from 'lucide-react';
import ProductCard from '../components/product/ProductCard';
import BackgroundCustomizer from '../components/common/BackgroundCustomizer';
import ReportModal from '../components/common/ReportModal';
import { useAuth } from '../context/AuthContext';
import { MOCK_PRODUCTS } from '../lib/seed';
import * as accountStore from '../lib/accountStore';
import { getCreatorProfile } from '../api/creatorApi';
import { getProductsByCreator } from '../api/productApi';
import AvatarFrame from '../components/common/AvatarFrame';
import BadgeIcon from '../components/common/BadgeIcon';
import BrandedLoader from '../components/common/BrandedLoader';
import { supabase, withTimeoutSafety } from '../lib/supabase';
import { BADGE_CATALOG, fetchGamificationState } from '../api/gamificationApi';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import { useTranslation } from 'react-i18next';
import { getLocalizedString } from '../utils/i18nHelpers';
import './CreatorProfilePage.css';

export default function CreatorProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, profile, updateProfile, isMockMode, followCreator, unfollowCreator, markCreatorViewed, isLoading: isAuthLoading } = useAuth();
  const { i18n } = useTranslation();
  const baseLang = (i18n.language || 'en').split('-')[0];

  const [creator, setCreator] = useState(null);
  const [creatorProducts, setCreatorProducts] = useState([]);
  const [gamificationState, setGamificationState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaderExiting, setIsLoaderExiting] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (isAuthLoading) return;
      setIsLoading(true);
      setIsLoaderExiting(false);
      
      const data = await getCreatorProfile(username, isMockMode);
      if (!isMounted) return;
      
      setCreator(data);
      if (data) {
        const prods = await getProductsByCreator(data.id, isMockMode);
        if (isMounted) {
          setCreatorProducts(prods);
        }
      }
      
      if (isMounted) {
        setIsLoaderExiting(true);
        setTimeout(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        }, 300); // Wait for the fade-out animation
      }

      // Fetch gamification state non-blockingly afterwards (only used for edit mode inventory)
      fetchGamificationState().then(gState => {
        if (isMounted) {
          setGamificationState(gState);
        }
      });
    }
    load();
    return () => { isMounted = false; };
  }, [username, isMockMode, isAuthLoading]);

  useEffect(() => {
    if (creator && user && creator.id !== user.id && profile?.following?.find(f => f.creatorId === creator.id)) {
      markCreatorViewed(creator.id);
    }
  }, [creator?.id, user?.id]); // run once when creator loads

  const isOwner = !!(profile && creator && profile.id === creator.id);

  const initialSettings = creator?.shop_settings || { bg_color: 'var(--color-bg)', card_radius: '16px', shadow_intensity: '0.05', links: [], show_featured: false };

  const [shopSettings, setShopSettings] = useState(initialSettings);
  const [isEditing, setIsEditing] = useState(false);
  const [activeEditSection, setActiveEditSection] = useState(null); // 'bio', 'links', 'featured'
  const [isSaving, setIsSaving] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const [shopNameStatus, setShopNameStatus] = useState('idle');
  const nameDebounceRef = useRef(null);

  const checkShopName = useCallback((value) => {
    if (!value || value.length < 3) {
      setShopNameStatus('idle');
      return;
    }
    setShopNameStatus('checking');
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(() => {
      const taken = accountStore.isShopNameTaken(value, creator?.id);
      setShopNameStatus(taken ? 'taken' : 'available');
    }, 400);
  }, [creator?.id]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [appearanceTab, setAppearanceTab] = useState('appearance');
  const [expandedAppearanceSection, setExpandedAppearanceSection] = useState(null);
  const [initialModalSettings, setInitialModalSettings] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pendingUploads, setPendingUploads] = useState({ banner: null, avatar: null });

  const openEditSection = (section) => {
    setInitialModalSettings(JSON.parse(JSON.stringify(shopSettings)));
    setActiveEditSection(section);
  };

  const closeEditSection = () => {
    if (JSON.stringify(shopSettings) !== JSON.stringify(initialModalSettings)) {
      setShowDiscardConfirm(true);
    } else {
      setActiveEditSection(null);
    }
  };

  const handleDiscardChanges = () => {
    if (blocker.state === 'blocked') {
      if (initialSettings) setShopSettings(initialSettings);
      setShowDiscardConfirm(false);
      setPendingUploads({ banner: null, avatar: null });
      blocker.proceed();
    } else {
      if (initialModalSettings) setShopSettings(initialModalSettings);
      setShowDiscardConfirm(false);
      setActiveEditSection(null);
      setPendingUploads({ banner: null, avatar: null });
    }
  };

  const handleContinueEditing = () => {
    setShowDiscardConfirm(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  // Drag & Drop State for Products
  const [orderedProducts, setOrderedProducts] = useState(creatorProducts);
  
  useEffect(() => {
    setOrderedProducts(creatorProducts);
  }, [creatorProducts]);

  const [draggedIdx, setDraggedIdx] = useState(null);
  const [isDraggingOverFeatured, setIsDraggingOverFeatured] = useState(false);

  // Draggable Modal State
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);

  const bannerInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const headerBg = shopSettings.header_bg || (shopSettings.bg_color ? { type: 'solid', solid: { color: shopSettings.bg_color } } : null);

  const getCardStyles = (settings, isEditMode) => {
    const bg = settings.card_bg || { type: 'solid', solid: { color: 'var(--color-bg-card)' } };
    const radius = settings.card_radius || '16px';
    const shadow = settings.card_shadow?.preset || 'none';
    
    let boxShadow = 'none';
    if (shadow !== 'none') {
      if (shadow === 'soft') boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
      else if (shadow === 'strong') boxShadow = '0 20px 40px rgba(0,0,0,0.15)';
      else boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
    }

    return {
      borderRadius: radius,
      boxShadow: boxShadow,
      border: shadow === 'none' ? '1px solid var(--color-border)' : '1px solid transparent',
      background: bg.type === 'gradient' && bg.gradient 
         ? `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.colorA}, ${bg.gradient.colorB})` 
         : (bg.solid?.color || 'var(--color-bg-card)'),
      pointerEvents: isEditMode ? 'none' : 'auto',
      '--card-title-color': settings.card_typography?.title,
      '--card-price-color': settings.card_typography?.price,
      '--card-desc-color': settings.card_typography?.description,
    };
  };

  const hasGlobalUnsavedChanges = () => {
    if (!initialSettings) return false;
    return JSON.stringify(shopSettings) !== JSON.stringify(initialSettings);
  };

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isEditing && hasGlobalUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowDiscardConfirm(true);
    }
  }, [blocker.state]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isEditing && hasGlobalUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing, shopSettings, initialSettings]);

  const hasUnsavedChanges = (tab) => {
    if (!initialModalSettings) return false;
    const str = (val) => JSON.stringify(val);
    
    if (tab === 'appearance') {
      return str(shopSettings.shop_bg) !== str(initialModalSettings.shop_bg) ||
             str(shopSettings.header_bg) !== str(initialModalSettings.header_bg) ||
             str(shopSettings.banner_bg) !== str(initialModalSettings.banner_bg) ||
             shopSettings.accent_color !== initialModalSettings.accent_color;
    }
    if (tab === 'cards') {
      return str(shopSettings.card_bg) !== str(initialModalSettings.card_bg) ||
             shopSettings.card_radius !== initialModalSettings.card_radius ||
             str(shopSettings.card_shadow) !== str(initialModalSettings.card_shadow) ||
             str(shopSettings.card_typography) !== str(initialModalSettings.card_typography);
    }
    if (tab === 'header') {
      return str(shopSettings.profile_frame) !== str(initialModalSettings.profile_frame) ||
             str(shopSettings.displayed_badges) !== str(initialModalSettings.displayed_badges) ||
             shopSettings.show_tier !== initialModalSettings.show_tier;
    }
    return false;
  };

  useEffect(() => {
    setShopSettings(creator?.shop_settings || { bg_color: 'var(--color-bg)', card_radius: '16px', shadow_intensity: '0.05', links: [] });
    setOrderedProducts(creatorProducts);
  }, [creator?.id]);

  if (isLoading) {
    return <BrandedLoader isExiting={isLoaderExiting} />;
  }

  if (!creator) {
    return (
      <div className="container py-3xl text-center">
        <h2 className="text-2xl font-bold">Creator not found</h2>
      </div>
    );
  }

  const saveEditSection = () => {
    if (activeEditSection === 'bio' && (shopNameStatus === 'taken' || shopNameStatus === 'checking')) return;
    // Local draft only: close the modal
    setActiveEditSection(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isOwner) {
        let finalSettings = { ...shopSettings };

        const uploadImage = async (file, folder) => {
          let safeType = file.type || 'image/jpeg';
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(safeType)) {
            safeType = 'image/jpeg';
          }
          const { data, error } = await withTimeoutSafety(() =>
            supabase.functions.invoke('generate-upload-url', {
              body: { 
                folder, 
                filename: file.name || 'upload.jpg', 
                contentType: safeType,
                fileSize: file.size
              }
            })
          );
          if (error) {
            console.error("Invoke Error:", error);
            throw error;
          }
          if (data?.error) throw new Error(data.error);

          const { uploadUrl, publicUrl } = data;
          
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': safeType,
              'Content-Length': file.size.toString()
            }
          });
          
          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            console.error("S3 Upload error:", errText);
            throw new Error('Upload to storage failed');
          }
          return publicUrl;
        };

        let profileUpdates = { shop_settings: finalSettings };
        
        if (pendingUploads.banner) {
          finalSettings.banner_url = await uploadImage(pendingUploads.banner, 'product-images');
        }
        if (pendingUploads.avatar) {
          finalSettings.profile_image_url = await uploadImage(pendingUploads.avatar, 'avatars');
          profileUpdates.avatar_url = finalSettings.profile_image_url;
        }

        await updateProfile(profileUpdates);
        setCreator(prev => ({ 
          ...prev, 
          shop_settings: finalSettings,
          ...(profileUpdates.avatar_url ? { avatar_url: profileUpdates.avatar_url } : {})
        }));

        setPendingUploads({ banner: null, avatar: null });
        setShopSettings(finalSettings);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save changes: " + err.message);
      // Revert to initial settings on error so we don't render broken blob previews
      if (initialSettings) setShopSettings(initialSettings);
      setPendingUploads({ banner: null, avatar: null });
    } finally {
      setIsSaving(false);
      setIsEditing(false);
      setActiveEditSection(null);
    }
  };

  const cancelEdit = () => {
    if (initialSettings) setShopSettings(initialSettings);
    setOrderedProducts(creatorProducts);
    setIsEditing(false);
    setActiveEditSection(null);
    setInitialModalSettings(null);
    setModalPos({ x: 0, y: 0 });
    setPendingUploads({ banner: null, avatar: null });
  };

  const handleImageUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setPendingUploads(prev => ({ ...prev, [type]: file }));
    if (type === 'banner') {
      setShopSettings(prev => ({ ...prev, banner_url: imageUrl }));
    } else {
      setShopSettings(prev => ({ ...prev, profile_image_url: imageUrl }));
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target) e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const items = [...orderedProducts];
    const draggedItem = items[draggedIdx];
    items.splice(draggedIdx, 1);
    items.splice(index, 0, draggedItem);
    setOrderedProducts(items);
    setDraggedIdx(index);
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    setDraggedIdx(null);
  };

  const handlePointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
    dragStart.current = {
      startX: e.clientX - modalPos.x,
      startY: e.clientY - modalPos.y,
      id: e.pointerId
    };
  };

  const handlePointerMove = (e) => {
    if (!dragStart.current || dragStart.current.id !== e.pointerId) return;
    setModalPos({
      x: e.clientX - dragStart.current.startX,
      y: e.clientY - dragStart.current.startY
    });
  };

  const handlePointerUp = (e) => {
    if (dragStart.current && dragStart.current.id === e.pointerId) {
      try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
      dragStart.current = null;
    }
  };

  const shopBg = shopSettings.shop_bg || { type: 'solid', solid: { color: 'var(--color-bg)' } };

  const customStyles = {
    backgroundColor: shopBg.type === 'solid' ? shopBg.solid.color : 'var(--color-bg)',
    backgroundImage: shopBg.type === 'gradient' ? `linear-gradient(${shopBg.gradient.angle}deg, ${shopBg.gradient.colorA}, ${shopBg.gradient.colorB})` : 'none',
    '--edit-bar-height': '60px',
    minHeight: '100vh',
    paddingBottom: '64px'
  };

  if (shopSettings.accent_color && shopSettings.accent_color !== 'var(--color-accent)') {
    customStyles['--color-accent'] = shopSettings.accent_color;
  }

  return (
    <div className={`creator-profile-page ${isEditing ? 'edit-mode-active' : ''}`} style={customStyles}>
      
      {!isEditing && (
        <button 
          onClick={() => navigate(-1)} 
          className="btn btn-icon" 
          style={{ 
            position: 'absolute', 
            top: '24px', 
            left: '24px', 
            zIndex: 50, 
            background: 'var(--color-bg-card)', 
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            borderRadius: 'var(--radius-full)'
          }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      )}


      {showDiscardConfirm && createPortal(
        <div className="creator-modal-overlay" style={{ zIndex: 20000, pointerEvents: 'auto', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="creator-modal-card p-xl flex flex-col items-center text-center" style={{ maxWidth: '320px' }}>
            <h3 className="text-lg font-bold mb-sm">Unsaved Changes</h3>
            <p className="text-secondary text-sm mb-lg">You have unsaved modifications that will be lost if you leave now.</p>
            <div className="flex flex-col gap-sm w-full">
              <button className="btn btn-primary" onClick={handleContinueEditing}>Continue Editing</button>
              <button className="btn btn-outline border-border text-red-500 hover:bg-red-500 hover:text-white" onClick={handleDiscardChanges}>Discard Changes</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeEditSection && createPortal(
        <div className="creator-modal-overlay" style={{ zIndex: 10010 }}>
          <div className="creator-modal-card" style={{ maxWidth: '400px', transform: `translate(${modalPos.x}px, ${modalPos.y}px)` }}>
            <div 
              className="creator-modal-header"
              style={{ cursor: 'grab' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <h3 className="creator-modal-title pointer-events-none">
                {activeEditSection === 'bio' && 'Edit Bio'}
                {activeEditSection === 'links' && 'Edit Links'}
                {activeEditSection === 'featured' && 'Featured Products'}
                {activeEditSection === 'appearance' && 'Customize Appearance'}
              </h3>
              <button className="creator-modal-close" onClick={closeEditSection}>
                <X size={20} />
              </button>
            </div>
            
            <div className="creator-modal-body">
              {activeEditSection === 'bio' && (
                <div className="flex flex-col gap-md">
                  <div className="creator-form-group">
                    <Input
                      label="Shop Name"
                      maxLength={30}
                      value={shopSettings.name !== undefined ? shopSettings.name : (creator.name || creator.username)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[<>]/g, '');
                        setShopSettings(prev => ({...prev, name: val}));
                        checkShopName(val);
                      }}
                      placeholder="My Awesome Shop"
                      size="lg"
                    />
                    <div className="mt-xs text-sm flex items-center h-5">
                      {shopNameStatus === 'checking' && <span className="text-secondary flex items-center gap-xs"><Loader2 size={14} className="spin" /> Checking availability...</span>}
                      {shopNameStatus === 'available' && <span className="text-green-500 flex items-center gap-xs"><CheckCircle2 size={14} /> Shop name is available!</span>}
                      {shopNameStatus === 'taken' && <span className="text-red-500 flex items-center gap-xs"><X size={14} /> Shop name is already taken</span>}
                    </div>
                  </div>
                  <div className="creator-form-group">
                    <Textarea
                      label="Bio"
                      minRows={4}
                      value={shopSettings.bio !== undefined ? shopSettings.bio : (creator.bio || '')}
                      onChange={(e) => setShopSettings(prev => ({...prev, bio: e.target.value}))}
                      placeholder="Write your bio..."
                    />
                  </div>
                </div>
              )}
              {activeEditSection === 'links' && (
                <div className="creator-form-group">
                  <label className="creator-form-label">External Links</label>
                  <p className="text-sm text-secondary mb-sm">Add links to your social media or personal website.</p>
                  <div className="flex flex-col gap-sm">
                    {(shopSettings.links || []).map((link, i) => (
                      <div key={i} className="flex gap-xs">
                         <Input value={link.title} readOnly placeholder="Title" />
                         <Input value={link.url} readOnly placeholder="URL" />
                      </div>
                    ))}
                    <button className="btn btn-outline btn-sm w-full flex-center gap-xs mt-xs">
                      <Plus size={14} /> Add Link
                    </button>
                  </div>
                </div>
              )}
              {activeEditSection === 'featured' && (
                <div className="creator-form-group">
                  <label className="creator-form-label">Select Products</label>
                  <p className="text-sm text-secondary">Select which products to pin to the top of your shop.</p>
                    <div className="mt-md flex flex-col gap-sm" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {orderedProducts.map(p => {
                        const isFeatured = (shopSettings.featured_products || []).includes(p.id);
                        return (
                          <div 
                            key={p.id} 
                            className="flex items-center gap-sm p-sm border border-border rounded-lg cursor-pointer hover:bg-bg-secondary"
                            onClick={() => {
                              const newFeatured = isFeatured 
                                ? (shopSettings.featured_products || []).filter(id => id !== p.id)
                                : [...(shopSettings.featured_products || []), p.id];
                              setShopSettings(prev => ({ ...prev, featured_products: newFeatured }));
                            }}
                          >
                            <input type="checkbox" checked={isFeatured} readOnly className="mr-sm cursor-pointer" />
                            <img src={p.images?.[0]} className="w-12 h-12 object-cover rounded" alt="" />
                            <span className="font-medium text-sm truncate">{getLocalizedString(p.title, baseLang)}</span>
                          </div>
                        );
                      })}
                    </div>
                </div>
              )}
              {activeEditSection === 'appearance' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="tab-nav-container">
                    {['appearance', 'cards', 'header'].map((tab) => {
                      const labels = { appearance: 'Appearance', cards: 'Cards', header: 'Header Card' };
                      return (
                        <button 
                          key={tab}
                          className={`tab-nav-btn ${appearanceTab === tab ? 'active' : ''}`}
                          onClick={() => setAppearanceTab(tab)}
                        >
                          {labels[tab]}
                          {hasUnsavedChanges(tab) && <span className="unsaved-dot" title="Unsaved Changes"></span>}
                        </button>
                      );
                    })}
                    <div 
                      className="tab-active-indicator" 
                      style={{ left: `${['appearance', 'cards', 'header'].indexOf(appearanceTab) * 33.333}%`, width: '33.333%' }}
                    ></div>
                  </div>

                  <div className="tab-content-container flex-1 overflow-y-auto pb-xl">
                    {appearanceTab === 'appearance' && (
                      <div className="tab-content-panel flex flex-col gap-sm">
                        <div className={`appearance-accordion-container ${expandedAppearanceSection === 'shop_bg' ? 'active' : ''}`}>
                          <button 
                            className="appearance-accordion-header"
                            onClick={() => setExpandedAppearanceSection(expandedAppearanceSection === 'shop_bg' ? null : 'shop_bg')}
                          >
                            <span className="appearance-accordion-title">Shop Background</span>
                            <span className="appearance-accordion-arrow">▼</span>
                          </button>
                          <div className={`accordion-wrapper ${expandedAppearanceSection === 'shop_bg' ? 'expanded' : ''}`}>
                            <div className="accordion-inner">
                              <div className="appearance-accordion-body accordion-content mt-md">
                                <BackgroundCustomizer 
                                  value={shopSettings.shop_bg || { type: 'solid', solid: { color: 'var(--color-bg)' } }}
                                  onChange={(newBg) => setShopSettings(prev => ({...prev, shop_bg: newBg}))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`appearance-accordion-container ${expandedAppearanceSection === 'header_bg' ? 'active' : ''}`}>
                          <button 
                            className="appearance-accordion-header"
                            onClick={() => setExpandedAppearanceSection(expandedAppearanceSection === 'header_bg' ? null : 'header_bg')}
                          >
                            <span className="appearance-accordion-title">Header Card Background</span>
                            <span className="appearance-accordion-arrow">▼</span>
                          </button>
                          <div className={`accordion-wrapper ${expandedAppearanceSection === 'header_bg' ? 'expanded' : ''}`}>
                            <div className="accordion-inner">
                              <div className="appearance-accordion-body accordion-content mt-md">
                                <BackgroundCustomizer 
                                  value={headerBg}
                                  onChange={(newBg) => setShopSettings(prev => ({...prev, header_bg: newBg, bg_color: undefined}))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`appearance-accordion-container ${expandedAppearanceSection === 'banner_bg' ? 'active' : ''}`}>
                          <button 
                            className="appearance-accordion-header"
                            onClick={() => setExpandedAppearanceSection(expandedAppearanceSection === 'banner_bg' ? null : 'banner_bg')}
                          >
                            <span className="appearance-accordion-title">Cover Banner Background</span>
                            <span className="appearance-accordion-arrow">▼</span>
                          </button>
                          <div className={`accordion-wrapper ${expandedAppearanceSection === 'banner_bg' ? 'expanded' : ''}`}>
                            <div className="accordion-inner">
                              <div className="appearance-accordion-body accordion-content mt-md">
                                <BackgroundCustomizer 
                                  value={shopSettings.banner_bg || { type: 'solid', solid: { color: 'var(--color-bg-secondary)' } }}
                                  onChange={(newBg) => setShopSettings(prev => ({...prev, banner_bg: newBg}))}
                                />
                                <div className="flex justify-end mt-sm pt-sm border-t border-border">
                                  <button 
                                    className="text-xs text-accent font-semibold hover:underline"
                                    onClick={() => setShopSettings(prev => ({...prev, banner_bg: JSON.parse(JSON.stringify(prev.shop_bg || { type: 'solid', solid: { color: 'var(--color-bg)' } }))}))}
                                  >
                                    Use Shop Background
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className={`appearance-accordion-container ${expandedAppearanceSection === 'accent' ? 'active' : ''}`}>
                          <button 
                            className="appearance-accordion-header"
                            onClick={() => setExpandedAppearanceSection(expandedAppearanceSection === 'accent' ? null : 'accent')}
                          >
                            <span className="appearance-accordion-title">Accent Color</span>
                            <span className="appearance-accordion-arrow">▼</span>
                          </button>
                          <div className={`accordion-wrapper ${expandedAppearanceSection === 'accent' ? 'expanded' : ''}`}>
                            <div className="accordion-inner">
                              <div className="appearance-accordion-body accordion-content mt-md">
                                <div className="flex flex-wrap gap-md">
                                  {[
                                    { color: 'var(--color-accent)', name: 'Primary (Blue/Purple)' },
                                    { color: '#10B981', name: 'Green' },
                                    { color: '#F59E0B', name: 'Orange' },
                                    { color: '#EF4444', name: 'Red' }
                                  ].map(opt => (
                                    <button
                                      key={opt.color}
                                      onClick={() => setShopSettings(prev => ({...prev, accent_color: opt.color}))}
                                      className="w-10 h-10 rounded-full flex-center transition-transform hover:scale-110"
                                      style={{ backgroundColor: opt.color, border: (shopSettings.accent_color || 'var(--color-accent)') === opt.color ? '2px solid var(--color-text-primary)' : '2px solid transparent', outline: (shopSettings.accent_color || 'var(--color-accent)') === opt.color ? '2px solid var(--color-bg)' : 'none', outlineOffset: '-4px' }}
                                      title={opt.name}
                                    >
                                      {(shopSettings.accent_color || 'var(--color-accent)') === opt.color && <Check size={16} color="var(--color-bg)" />}
                                    </button>
                                  ))}
                                  
                                  <label className="w-10 h-10 rounded-full flex-center cursor-pointer transition-transform hover:scale-110 relative" title="Custom Accent Color" style={{ border: (shopSettings.accent_color?.startsWith('#') && !['#10B981', '#F59E0B', '#EF4444'].includes(shopSettings.accent_color.toUpperCase())) ? '2px solid var(--color-text-primary)' : '2px solid var(--color-border)' }}>
                                    <div className="w-full h-full rounded-full" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}></div>
                                    <input 
                                      type="color" 
                                      value={shopSettings.accent_color?.startsWith('#') ? shopSettings.accent_color : '#6366f1'} 
                                      onChange={(e) => setShopSettings(prev => ({...prev, accent_color: e.target.value}))} 
                                      className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    {(shopSettings.accent_color?.startsWith('#') && !['#10B981', '#F59E0B', '#EF4444'].includes(shopSettings.accent_color.toUpperCase())) && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-full pointer-events-none">
                                        <Check size={16} color="#fff" />
                                      </div>
                                    )}
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {appearanceTab === 'cards' && (
                      <div className="tab-content-panel flex flex-col gap-sm">
                        <div className={`appearance-accordion-container ${expandedAppearanceSection === 'card_bg' ? 'active' : ''}`}>
                          <button 
                            className="appearance-accordion-header"
                            onClick={() => setExpandedAppearanceSection(expandedAppearanceSection === 'card_bg' ? null : 'card_bg')}
                          >
                            <span className="appearance-accordion-title">Card Background</span>
                            <span className="appearance-accordion-arrow">▼</span>
                          </button>
                          <div className={`accordion-wrapper ${expandedAppearanceSection === 'card_bg' ? 'expanded' : ''}`}>
                            <div className="accordion-inner">
                              <div className="appearance-accordion-body accordion-content mt-md">
                                <BackgroundCustomizer 
                                  value={shopSettings.card_bg || { type: 'solid', solid: { color: 'var(--color-bg-card)' } }}
                                  onChange={(newBg) => setShopSettings(prev => ({...prev, card_bg: newBg}))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="creator-form-group mt-md px-md">
                          <label className="creator-form-label">Border Radius</label>
                          <div className="flex gap-md mt-sm">
                            {[
                              { value: '0px', label: 'Sharp', radius: '0px' },
                              { value: '8px', label: 'Medium', radius: '4px' },
                              { value: '16px', label: 'Rounded', radius: '8px' },
                              { value: '24px', label: 'Pill', radius: '16px' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                className={`preview-card-btn ${(shopSettings.card_radius || '16px') === opt.value ? 'active' : ''}`}
                                onClick={() => setShopSettings(prev => ({...prev, card_radius: opt.value}))}
                              >
                                <div className="preview-card-box" style={{ borderRadius: opt.radius }}></div>
                                <span className="preview-card-label">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="creator-form-group mt-xl px-md">
                          <label className="creator-form-label">Shadows (Presets)</label>
                          <div className="flex gap-md mt-sm">
                            {[
                              { value: 'none', label: 'None', shadow: 'none' },
                              { value: 'soft', label: 'Soft', shadow: '0 4px 12px rgba(0,0,0,0.08)' },
                              { value: 'medium', label: 'Medium', shadow: '0 8px 24px rgba(0,0,0,0.15)' },
                              { value: 'strong', label: 'Strong', shadow: '0 16px 40px rgba(0,0,0,0.25)' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                className={`preview-card-btn ${(shopSettings.card_shadow?.preset || 'none') === opt.value ? 'active' : ''}`}
                                onClick={() => setShopSettings(prev => ({...prev, card_shadow: { preset: opt.value }}))}
                              >
                                <div className="preview-card-box" style={{ borderRadius: '6px', boxShadow: opt.shadow, border: opt.value === 'none' ? '2px solid var(--color-border)' : '1px solid transparent' }}></div>
                                <span className="preview-card-label">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className={`appearance-accordion-container mt-xl ${expandedAppearanceSection === 'typography' ? 'active' : ''}`}>
                          <button 
                            className="appearance-accordion-header"
                            onClick={() => setExpandedAppearanceSection(expandedAppearanceSection === 'typography' ? null : 'typography')}
                          >
                            <span className="appearance-accordion-title">Card Typography Colors</span>
                            <span className="appearance-accordion-arrow">▼</span>
                          </button>
                          <div className={`accordion-wrapper ${expandedAppearanceSection === 'typography' ? 'expanded' : ''}`}>
                            <div className="accordion-inner">
                              <div className="appearance-accordion-body accordion-content mt-md flex flex-col gap-md">
                                {['title', 'price', 'description'].map(key => (
                                  <div key={key} className="flex justify-between items-center">
                                    <span className="text-sm font-semibold capitalize">{key}</span>
                                    <label className="w-8 h-8 rounded-full flex-center cursor-pointer relative shadow-sm border border-border" style={{ backgroundColor: shopSettings.card_typography?.[key] || 'var(--color-bg-tertiary)' }}>
                                      <input 
                                        type="color" 
                                        value={shopSettings.card_typography?.[key] || '#ffffff'}
                                        onChange={(e) => setShopSettings(prev => ({...prev, card_typography: { ...prev.card_typography, [key]: e.target.value }}))} 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                      />
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {appearanceTab === 'header' && (
                      <div className="tab-content-panel flex flex-col gap-sm">
                        <div className="creator-form-group px-md mt-sm">
                          <label className="creator-form-label">Profile Badge Frame</label>
                          <p className="text-xs text-secondary mb-md">Display an achievement frame around your avatar.</p>
                          <div className="creator-toggle-group flex gap-sm" style={{ width: 'fit-content' }}>
                            <button 
                              className={`creator-toggle-btn ${shopSettings.profile_frame?.enabled !== false ? 'active' : ''} px-md py-xs rounded-full border border-transparent text-sm`}
                              onClick={() => setShopSettings(prev => ({...prev, profile_frame: { ...prev.profile_frame, enabled: true, selected: 'gold' }}))}
                            >
                              Show Frame
                            </button>
                            <button 
                              className={`creator-toggle-btn ${shopSettings.profile_frame?.enabled === false ? 'active' : ''} px-md py-xs rounded-full border border-transparent text-sm`}
                              onClick={() => setShopSettings(prev => ({...prev, profile_frame: { ...prev.profile_frame, enabled: false }}))}
                            >
                              Hide
                            </button>
                          </div>
                        </div>

                        <div className="creator-form-group px-md mt-xl">
                          <div className="flex justify-between items-center mb-sm">
                            <label className="creator-form-label mb-0">Shop Badges (Max 5)</label>
                            <span className="text-xs font-medium text-secondary">{shopSettings.displayed_badges?.length || 0}/5</span>
                          </div>
                          
                          <div className="badge-inventory mt-md">
                            <div>
                              <span className="text-xs font-semibold text-secondary uppercase tracking-wider mb-xs block">Displayed on Shop (Drag to reorder)</span>
                              <div className="badge-row">
                                {(shopSettings.displayed_badges || []).map((badgeId, idx) => {
                                  const badge = BADGE_CATALOG.find(b => b.id === badgeId);
                                  if (!badge) return null;
                                  return (
                                    <div 
                                      key={badgeId} 
                                      draggable 
                                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', idx.toString()); e.target.style.opacity = '0.5'; }}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={(e) => {
                                        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                        setShopSettings(prev => {
                                          const arr = [...(prev.displayed_badges || [])];
                                          const [moved] = arr.splice(fromIdx, 1);
                                          arr.splice(idx, 0, moved);
                                          return { ...prev, displayed_badges: arr };
                                        });
                                      }}
                                      onDragEnd={(e) => e.target.style.opacity = '1'}
                                      onClick={() => setShopSettings(prev => ({ ...prev, displayed_badges: prev.displayed_badges.filter(id => id !== badgeId) }))}
                                      className="badge-item active"
                                      title="Click to remove"
                                    >
                                      <BadgeIcon badge={badge} size="sm" />
                                      <span className="text-xs font-bold">{badge.title}</span>
                                      <X size={12} className="ml-xs opacity-60 hover:opacity-100" />
                                    </div>
                                  );
                                })}
                                {(shopSettings.displayed_badges || []).length === 0 && (
                                  <span className="text-sm text-secondary italic self-center ml-sm">No badges selected.</span>
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-xs font-semibold text-secondary uppercase tracking-wider mb-xs block">Available Badges (Click to add)</span>
                              <div className="badge-row bg-transparent border-transparent px-0">
                                {(gamificationState?.unlockedBadges || []).filter(b => !(shopSettings.displayed_badges || []).includes(b)).map(badgeId => {
                                  const badge = BADGE_CATALOG.find(b => b.id === badgeId);
                                  if (!badge) return null;
                                  const isAtMax = (shopSettings.displayed_badges || []).length >= 5;
                                  return (
                                    <div 
                                      key={badgeId} 
                                      onClick={() => {
                                        if (isAtMax) return;
                                        setShopSettings(prev => ({ ...prev, displayed_badges: [...(prev.displayed_badges || []), badgeId] }));
                                      }}
                                      className={`badge-item ${isAtMax ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      title={isAtMax ? 'Maximum of 5 badges reached' : 'Click to add'}
                                    >
                                      <BadgeIcon badge={badge} size="sm" />
                                      <span className="text-xs font-bold text-text-primary">{badge.title}</span>
                                    </div>
                                  );
                                })}
                                {(gamificationState?.unlockedBadges || []).filter(b => !(shopSettings.displayed_badges || []).includes(b)).length === 0 && (
                                  <span className="text-sm text-secondary italic self-center ml-sm">All unlocked badges are displayed.</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="creator-modal-footer">
              <button className="btn btn-primary w-full" onClick={saveEditSection} disabled={isSaving}>
                {isSaving ? <span className="loader spin" style={{width: 14, height: 14}}></span> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div 
        className={`profile-cover relative transition-all ${isEditing ? 'edit-mode-wrapper group' : ''}`} 
        style={{ 
          backgroundImage: shopSettings.banner_url ? `url(${shopSettings.banner_url})` : (shopSettings.banner_bg?.type === 'gradient' ? `linear-gradient(${shopSettings.banner_bg.gradient.angle}deg, ${shopSettings.banner_bg.gradient.colorA}, ${shopSettings.banner_bg.gradient.colorB})` : 'none'),
          backgroundColor: shopSettings.banner_url ? 'transparent' : (shopSettings.banner_bg?.type === 'solid' ? shopSettings.banner_bg.solid.color : 'var(--color-bg-secondary)'),
        }}
      >
        {isEditing && (
          <>
            <div className="absolute top-md right-md flex gap-sm z-20">
              <button 
                className="edit-mode-indicator relative top-auto right-auto" 
                onClick={() => bannerInputRef.current?.click()}
                title="Edit Cover Banner"
              >
                <Camera size={16} />
              </button>
              {shopSettings.banner_url && (
                <button 
                  className="edit-mode-indicator relative top-auto right-auto !text-red-500 hover:!bg-red-50 hover:!border-red-200" 
                  onClick={() => setShopSettings(prev => ({...prev, banner_url: null}))}
                  title="Remove Banner"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <input type="file" hidden ref={bannerInputRef} onChange={(e) => handleImageUpload(e, 'banner')} accept="image/*" />
          </>
        )}
      </div>
      
      <div className="container" style={{ marginTop: '-80px', position: 'relative', zIndex: 10 }}>
        <div 
          className="profile-header-card bg-bg-card border border-border shadow-md relative"
          style={{
            background: headerBg ? (headerBg.type === 'gradient' && headerBg.gradient ? `linear-gradient(${headerBg.gradient.angle}deg, ${headerBg.gradient.colorA}, ${headerBg.gradient.colorB})` : (headerBg.solid ? headerBg.solid.color : 'var(--color-bg-card)')) : 'var(--color-bg-card)',
          }}
        >
          
          {isEditing && (
            <div className="edit-action-panel-wrapper">
              <div className="edit-action-panel-inner">
                <button 
                  className="btn w-full flex-center justify-center gap-sm transition-transform hover:scale-105 rounded-lg py-sm px-md shadow-md mb-xs"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', border: '1px solid var(--color-border-strong)' }}
                  onClick={() => openEditSection('appearance')}
                >
                  <Palette size={16} />
                  <span className="font-bold">Appearance</span>
                </button>
                <div className="h-px bg-border w-full my-xs"></div>
                <button className="btn btn-outline w-full rounded-lg" onClick={cancelEdit}>Cancel</button>
                <button className="btn btn-primary w-full rounded-lg" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <span className="loader spin" style={{width: 14, height: 14}}></span> : 'Done'}
                </button>
              </div>
            </div>
          )}
          
          {!isEditing && isOwner && (
            <div className="hidden md:block absolute top-md right-md">
               <button className="btn btn-outline flex-center gap-sm rounded-full" onClick={() => setIsEditing(true)}>
                 <Edit2 size={16} /> Edit My Shop
               </button>
            </div>
          )}

          <div className={`profile-avatar-large relative ${isEditing ? 'edit-mode-wrapper group' : ''}`} style={{ background: 'transparent' }}>
            <AvatarFrame tier={shopSettings.profile_frame?.enabled !== false ? creator.tier : 'none'} imageUrl={shopSettings.profile_image_url || creator.avatar_url} size="xl" />
            {isEditing && (
              <>
                <div 
                  className="edit-mode-indicator pos-bottom-right" 
                  onClick={() => avatarInputRef.current?.click()}
                  title="Edit Profile Picture"
                >
                  <Camera size={16} />
                </div>
              </>
            )}
            <input type="file" hidden ref={avatarInputRef} onChange={(e) => handleImageUpload(e, 'avatar')} accept="image/*" />
          </div>
          
          <div className={`profile-info-main mt-md md:mt-0 relative rounded-lg p-xs -ml-xs border border-transparent transition-colors ${isEditing ? 'edit-mode-wrapper group hover:border-dashed hover:border-border' : ''}`}>
            <h1 className="profile-name flex items-center justify-center md:justify-start gap-xs">
              {shopSettings.name !== undefined ? shopSettings.name : (creator.name || creator.username)}
              <CheckCircle2 size={24} className="text-accent relative top-[-1px]" />
            </h1>
            <p className={`profile-bio mt-xs mx-auto md:mx-0 ${!(shopSettings.bio !== undefined ? shopSettings.bio : creator.bio) ? 'text-secondary opacity-60 italic' : ''}`}>
              {(shopSettings.bio !== undefined ? shopSettings.bio : creator.bio) || 'Write your bio...'}
            </p>
            
            {!isOwner && user && (
              <div className="mt-md flex justify-center md:justify-start gap-sm">
                <button 
                  className={`btn btn-sm flex-center gap-xs ${profile?.following?.find(f => f.creatorId === creator.id) ? 'btn-secondary text-accent' : 'btn-outline'}`}
                  onClick={() => {
                    if (profile?.following?.find(f => f.creatorId === creator.id)) {
                      unfollowCreator(creator.id);
                    } else {
                      followCreator(creator.id);
                    }
                  }}
                >
                  <UserPlus size={14} /> 
                  {profile?.following?.find(f => f.creatorId === creator.id) ? 'Following' : 'Follow'}
                </button>
                <button 
                  className="btn btn-sm btn-outline text-secondary hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                  onClick={() => setIsReportModalOpen(true)}
                  title="Report Profile"
                >
                  <Flag size={14} />
                </button>
              </div>
            )}
            {!user && !isOwner && (
              <div className="mt-md flex justify-center md:justify-start gap-sm">
                <button className="btn btn-sm btn-outline flex-center gap-xs" onClick={() => navigate('/login')}>
                  <UserPlus size={14} /> Follow
                </button>
                <button 
                  className="btn btn-sm btn-outline text-secondary hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                  onClick={() => navigate('/login')}
                  title="Report Profile"
                >
                  <Flag size={14} />
                </button>
              </div>
            )}

            {isEditing && (
              <>
                <div 
                  className="edit-mode-indicator" 
                  onClick={() => openEditSection('bio')}
                  title="Edit Profile Info"
                >
                  <Edit2 size={16} />
                </div>
              </>
            )}
          </div>

          <div className="profile-actions-stats flex items-center justify-center md:justify-end gap-xl w-full md:w-auto mt-lg md:mt-0 border-t border-border md:border-t-0 pt-md md:pt-0">
            {shopSettings.show_follower_count && (
              <div className="profile-stat">
                <span className="stat-num">{creator.follower_count || 0}</span>
                <span className="stat-lbl">Followers</span>
              </div>
            )}
            <div className="profile-stat">
              <span className="stat-num">{creatorProducts.length}</span>
              <span className="stat-lbl">Products</span>
            </div>
            <div className="profile-stat">
              <span className="stat-num uppercase" style={{ color: `var(--color-text-primary)` }}>{creator.tier}</span>
              <span className="stat-lbl">Creator Tier</span>
            </div>
            <div className="profile-stat">
              <div className="flex items-center gap-xs">
                <Star size={18} className="relative top-[-1px]" style={{ color: 'var(--color-gold, #B8972A)' }} fill="currentColor" />
                <span className="stat-num">{creator.rating || '5.0'}</span>
              </div>
              <span className="stat-lbl">Rating</span>
            </div>
          </div>

          {/* Shop Badges Showcase */}
          {(creator.displayed_badges || []).length > 0 && (
            <div className="w-full mt-xl pt-lg border-t border-border flex flex-col items-center md:items-start relative z-20">
              <div className="flex items-center gap-sm mb-md text-sm font-bold text-secondary uppercase tracking-wider">
                <span style={{ fontSize: '1.2em' }}>🏅</span> Achievements
              </div>
              
              <div className="w-full pb-sm">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-lg">
                  {(creator.displayed_badges || []).map(badgeId => {
                    const badge = BADGE_CATALOG.find(b => b.id === badgeId);
                    if (!badge) return null;
                    return (
                      <div key={badge.id} className="group relative flex flex-col items-center">
                        <BadgeIcon badge={badge} size="md" interactive={true} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Links Placeholder inside Header Card (Optional) */}
          <div className={`w-full mt-md pt-md border-t border-border relative rounded-lg p-xs -mx-xs border border-transparent transition-colors ${isEditing ? 'edit-mode-wrapper group hover:border-dashed hover:border-border' : ''}`}>
             <div className="flex flex-wrap gap-sm justify-center md:justify-start">
               {(!shopSettings.links || shopSettings.links.length === 0) ? (
                 <span className="text-secondary text-sm italic py-xs">No external links added.</span>
               ) : (
                 shopSettings.links.map((link, i) => (
                   <a key={i} href={link.url} target="_blank" rel="noreferrer" className="text-accent hover:underline text-sm font-medium">
                     {link.title}
                   </a>
                 ))
               )}
             </div>
             {isEditing && (
              <>
                <div 
                  className="edit-mode-indicator" 
                  onClick={() => openEditSection('links')}
                  title="Edit Links"
                >
                  <Edit2 size={16} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Featured Products */}
        {(shopSettings.show_featured !== false || isEditing) && (
          <>
            <div 
              className={`profile-content mb-xl relative p-md -mx-md border rounded-xl transition-all ${isEditing ? 'edit-mode-wrapper group' : 'border-transparent'} ${shopSettings.show_featured === false ? 'opacity-50 grayscale' : ''} ${isDraggingOverFeatured ? 'bg-bg-secondary border-accent border-dashed' : (isEditing ? 'hover:border-dashed hover:border-border border-transparent' : '')}`}
              onDragOver={(e) => {
                if (isEditing) {
                  e.preventDefault();
                  setIsDraggingOverFeatured(true);
                }
              }}
              onDragLeave={(e) => {
                if (isEditing) {
                  e.preventDefault();
                  setIsDraggingOverFeatured(false);
                }
              }}
              onDrop={(e) => {
                if (!isEditing || draggedIdx === null) return;
                e.preventDefault();
                setIsDraggingOverFeatured(false);
                const product = orderedProducts[draggedIdx];
                const featuredProductIds = shopSettings.featured_products || [];
                if (product && !featuredProductIds.includes(product.id)) {
                  setShopSettings(prev => ({ ...prev, featured_products: [...featuredProductIds, product.id] }));
                }
              }}
            >
              <div className="flex items-center justify-between mb-lg relative z-30">
                <div className="flex items-center gap-sm">
                  <h2 className="text-xl font-bold">Featured</h2>
                  {shopSettings.show_featured === false && (
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary border border-border px-xs py-1 rounded">Hidden</span>
                  )}
                </div>
                {isEditing && (
                  <div className="flex gap-sm items-center z-40 relative">
                    <button 
                      className={`flex-center gap-sm px-md py-sm rounded-full text-sm font-bold shadow-sm transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 border ${shopSettings.show_featured === false ? 'bg-bg-secondary text-text-primary border-border hover:bg-bg-tertiary' : 'bg-accent text-white border-transparent hover:shadow-md'}`}
                      onClick={() => setShopSettings(prev => ({...prev, show_featured: prev.show_featured === false ? true : false}))}
                      title={shopSettings.show_featured === false ? 'Click to make Visible' : 'Click to Hide'}
                    >
                      {shopSettings.show_featured === false ? <EyeOff size={16} /> : <Eye size={16} />} 
                      {shopSettings.show_featured === false ? 'Section Hidden' : 'Section Visible'}
                    </button>
                  </div>
                )}
              </div>
              {creatorProducts.length === 0 ? (
                 <p className="text-secondary relative z-30">No products available to feature.</p>
              ) : (shopSettings.featured_products || []).length === 0 ? (
                 <p className="text-secondary relative z-30">No products have been featured yet. Edit your shop to select featured products.</p>
              ) : (
                <div className="products-grid relative z-30">
                   {orderedProducts.filter(p => (shopSettings.featured_products || []).includes(p.id)).map(product => (
                     <div key={product.id} className="relative group/featured">
                       <ProductCard 
                         product={{...product, creatorName: shopSettings.name || creator.name || creator.username}} 
                         cardStyle={getCardStyles(shopSettings, true)}
                       />
                       {isEditing && (
                         <button 
                           className="absolute -top-sm -right-sm bg-bg-card border border-border p-xs rounded-full shadow-sm opacity-0 group-hover/featured:opacity-100 transition-opacity z-50 text-red-500 hover:bg-red-50 hover:border-red-200"
                           onClick={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             const newFeatured = (shopSettings.featured_products || []).filter(id => id !== product.id);
                             setShopSettings(prev => ({ ...prev, featured_products: newFeatured }));
                           }}
                           title="Remove from featured"
                         >
                           <X size={14} />
                         </button>
                       )}
                     </div>
                   ))}
                </div>
              )}
            </div>

            {/* Separator between Featured and All Products */}
            <hr className="my-xl" style={{ borderColor: 'var(--color-accent)', opacity: 0.3, borderWidth: '2px', borderStyle: 'solid', borderRadius: '2px' }} />
          </>
        )}

        {/* All Product Grid */}
        <div className="profile-content">
          <h2 className="text-xl font-bold mb-lg">All Products</h2>
          {creatorProducts.length === 0 ? (
            <div className="premium-empty-state">
              <div className="empty-illustration">
                <LayoutDashboard size={48} />
              </div>
              <h3 className="text-lg font-bold mb-xs">No products yet</h3>
              <p className="text-secondary max-w-sm mx-auto mb-lg">This creator hasn't published any products to their shop yet.</p>
              {isOwner && !isEditing && (
                <Link to="/dashboard/upload" className="btn btn-primary">
                  Publish your first product
                </Link>
              )}
            </div>
          ) : (
            <div className="products-grid">
              {orderedProducts
                .filter(product => !(shopSettings.show_featured !== false || isEditing) || !(shopSettings.featured_products || []).includes(product.id))
                .map((product, idx) => (
                <div 
                  key={product.id}
                  draggable={isEditing}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`relative ${isEditing ? 'cursor-grab active:cursor-grabbing group' : ''}`}
                >
                  <ProductCard 
                    product={{...product, creatorName: shopSettings.name || creator.name || creator.username}} 
                    cardStyle={getCardStyles(shopSettings, isEditing)}
                  />
                  {isEditing && (
                    <div className="absolute top-sm right-sm bg-bg-card border border-border p-xs rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <GripVertical size={16} className="text-secondary" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {creator && (
        <ReportModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          type="creator" 
          targetId={creator.id} 
        />
      )}

      {/* Mobile Sticky Edit Button */}
      {!isEditing && isOwner && (
        <div className="md:hidden fixed bottom-md left-1/2 -translate-x-1/2" style={{ zIndex: 40, width: 'calc(100% - 32px)', maxWidth: '340px' }}>
          <button 
            className="btn btn-primary w-full flex-center gap-sm shadow-xl rounded-full py-md text-base" 
            onClick={() => setIsEditing(true)}
          >
            <Edit2 size={18} /> Edit My Shop
          </button>
        </div>
      )}
    </div>
  );
}
