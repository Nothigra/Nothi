import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate } from 'react-router';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleDollarSign, FileArchive, Image as ImageIcon,
  Pencil, Rocket, Share2, Sparkles, Tag, Upload, Wallet, X, Zap, Package, Contrast, Volume2,
  ArrowRightLeft, LayoutTemplate, TerminalSquare, Layers, FolderArchive, AlertCircle, Globe,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGamification } from '../../context/GamificationContext';
import { CATEGORIES, SOFTWARE_LIST, STYLE_LIST } from '../../lib/seed';
import { supabase, withTimeoutSafety } from '../../lib/supabase';
import { isPro, getPlanLimits, formatFileSize } from '../../config/plans';
import { activateProBoost, billingErrorMessage } from '../../api/billingApi';
import MediaUploader from '../../components/upload/MediaUploader';
import ProductCard from '../../components/product/ProductCard';
import {
  formatEur, MIN_PAID_PRICE, MIN_SALE_PRICE, toDateInputValue, todayInputValue, validatePromo,
  promoPayload, estimateRevenue, BOOST_PLANS, checkProductFile, saveProduct,
} from '../../lib/productPublishing';
import { tap, notify, shareLink } from '../../lib/native';
import './AppPublish.css';

const CAT_ICONS = { Package, Sparkles, FolderArchive, Contrast, Volume2, ArrowRightLeft, LayoutTemplate, TerminalSquare, Layers };
const INTRO_KEY = 'nothi-seller-intro-seen';

const STEPS = [
  { id: 'media', title: 'Show it off', sub: 'Add images or a short video. The first one is your cover.' },
  { id: 'file', title: 'Your file', sub: 'This is what buyers download.' },
  { id: 'details', title: 'Describe it', sub: 'Help editors find it and know what they get.' },
  { id: 'price', title: 'Set your price', sub: 'Free or paid — you can change it anytime.' },
  { id: 'review', title: 'Ready to go?', sub: 'This is how your product will look.' },
];

function Chips({ options, value, onChange, multiple, icons }) {
  const selected = multiple ? value : [value];
  return (
    <div className="pub-chips">
      {options.map((o) => {
        const on = selected.includes(o.value);
        const Icon = icons?.[o.icon];
        return (
          <button
            key={o.value}
            type="button"
            className={`pub-chip ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => {
              tap();
              if (!multiple) onChange(o.value);
              else onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value]);
            }}
          >
            {Icon && <Icon size={16} />}
            {o.label}
            {multiple && on && <Check size={14} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

export default function AppPublishPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, updateProfile, isMockMode } = useAuth();
  const { refreshState } = useGamification();

  const editing = location.state?.product && new URLSearchParams(location.search).has('edit') ? location.state.product : null;
  const PRO = isPro(profile);
  const { maxFileSizeMB, maxProducts } = getPlanLimits(profile);

  // ── form state
  const [form, setForm] = useState(() => {
    const p = editing;
    return {
      title: p?.title || '',
      description: p?.description || '',
      category: p?.category || '',
      software: p?.software || [],
      style: p?.style || [],
      pricing: p ? (Number(p.price) > 0 ? 'paid' : 'free') : 'paid',
      price: p && Number(p.price) > 0 ? String(p.price) : '',
      promoEnabled: p?.sale_price != null,
      salePrice: p?.sale_price != null ? String(p.sale_price) : '',
      saleEndsAt: p?.sale_ends_at ? toDateInputValue(p.sale_ends_at) : '',
    };
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const [mediaItems, setMediaItems] = useState(() =>
    Array.isArray(editing?.media) ? editing.media.map((m) => ({ ...m, id: Math.random().toString(36).slice(2), isUploading: false })) : []);
  const [productFile, setProductFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [boost, setBoost] = useState('none');
  const fileInputRef = useRef(null);

  // ── flow state
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false); // show field errors after a Continue attempt
  const [phase, setPhase] = useState(null); // null | creating | uploading | publishing | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [publishedId, setPublishedId] = useState(null);
  const [boostNote, setBoostNote] = useState('');
  const draftIdRef = useRef(null);

  // First-time sellers see a short intro; sellers at the Free limit see why they can't publish
  const [productCount, setProductCount] = useState(isMockMode ? (profile?.products || []).length : null);
  useEffect(() => {
    if (isMockMode || editing || !profile?.id) return;
    let alive = true;
    withTimeoutSafety(() => supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', profile.id))
      .then(({ count }) => { if (alive) setProductCount(count ?? 0); })
      .catch(() => { if (alive) setProductCount(-1); });
    return () => { alive = false; };
  }, [profile?.id, isMockMode, editing]);
  const [introDismissed, setIntroDismissed] = useState(() => {
    try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return true; }
  });
  const showIntro = !editing && productCount === 0 && !introDismissed;
  const atLimit = !editing && !PRO && productCount != null && productCount >= maxProducts;

  // ── derived validity per step
  const mediaReady = mediaItems.some((m) => !m.isUploading && m.url);
  const mediaUploading = mediaItems.some((m) => m.isUploading);
  const fileReady = !!productFile || !!editing;
  const titleOk = form.title.trim().length >= 3;
  const descOk = form.description.trim().length > 0;
  const detailsOk = titleOk && descOk && !!form.category && form.software.length > 0 && form.style.length > 0;
  const priceNum = parseFloat(form.price);
  const saleNum = parseFloat(form.salePrice);
  const onSale = form.pricing === 'paid' && form.promoEnabled && saleNum > 0 && saleNum < priceNum;
  // What the seller earns on the price buyers actually pay (sale price while a promotion runs)
  const revenue = estimateRevenue(form.pricing === 'paid' ? (onSale ? saleNum : form.price) : 0);
  const fullRevenue = estimateRevenue(form.pricing === 'paid' ? form.price : 0);
  const priceProblem = form.pricing === 'free' ? ''
    : !form.price ? 'Enter a price.'
    : Number.isNaN(priceNum) || priceNum < MIN_PAID_PRICE ? `The minimum price is ${formatEur(MIN_PAID_PRICE)}.`
    : fullRevenue.net <= 0 ? 'This price is too low to cover the payment fees.'
    : '';
  const promoProblem = form.pricing === 'paid' ? validatePromo({ ...form }) : '';
  const priceOk = !priceProblem && !promoProblem;

  const stepOk = [mediaReady && !mediaUploading, fileReady, detailsOk, priceOk, mediaReady && fileReady && detailsOk && priceOk];
  const dirty = !publishedId && (mediaItems.length > 0 || !!productFile || form.title || form.description);

  // Leaving with unsaved work (back button, swipe, Android back) asks first
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !!dirty && (phase === null || phase === 'error') && currentLocation.pathname !== nextLocation.pathname);

  const go = (i) => {
    setTouched(false);
    setStep(i);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const next = () => {
    tap();
    if (!stepOk[step]) { setTouched(true); notify('WARNING'); return; }
    if (step < STEPS.length - 1) go(step + 1);
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const problem = checkProductFile(f, { maxFileSizeMB, isProPlan: PRO });
    setFileError(problem);
    setProductFile(problem ? null : f);
    if (!problem) tap('MEDIUM');
  };

  const payload = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    price: form.pricing === 'paid' ? Math.round(priceNum * 100) / 100 : 0,
    category: form.category,
    software: form.software,
    style: form.style,
    media: mediaItems.filter((m) => !m.isUploading && m.url).map((m, i) => ({
      type: m.type, url: m.url, posterUrl: m.posterUrl, ...(m.thumbUrl ? { thumbUrl: m.thumbUrl } : {}), order: i,
    })),
    ...promoPayload(form.pricing === 'paid' ? form : { promoEnabled: false }),
  });

  const publish = async () => {
    tap('MEDIUM');
    if (!stepOk.every(Boolean)) { setTouched(true); return; }
    setError('');
    setProgress(0);
    setPhase('creating');
    try {
      let id;
      if (isMockMode) {
        await new Promise((r) => setTimeout(r, 900));
        const list = profile?.products || [];
        if (editing) {
          id = editing.id;
          await updateProfile({ products: list.map((p) => (p.id === id ? { ...p, ...payload() } : p)) });
        } else {
          id = 'prod-' + Date.now();
          await updateProfile({ products: [{ ...payload(), id, status: 'published', creator_id: profile?.id, sales_count: 0, revenue: 0, created_at: new Date().toISOString() }, ...list] });
        }
      } else {
        id = await saveProduct({
          editingId: editing?.id,
          draftId: draftIdRef.current,
          sellerId: profile?.id,
          payload: payload(),
          productFile,
          onPhase: setPhase,
          onProgress: setProgress,
          onDraftCreated: (draft) => { draftIdRef.current = draft; },
        });
        if (!editing) refreshState?.();
        const plan = BOOST_PLANS.find((p) => p.id === boost);
        if (!editing && PRO && plan?.days) {
          try { await activateProBoost(id, plan.days); }
          catch (err) { setBoostNote(`Published, but the boost wasn't applied: ${billingErrorMessage(err)}`); }
        }
      }
      setPublishedId(id);
      setPhase('done');
      notify('SUCCESS');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setPhase('error');
      notify('ERROR');
    }
  };

  // ── Screens ─────────────────────────────────────────────────────────────
  if (atLimit) {
    return (
      <div className="pub-page pub-center">
        <div className="pub-hero-icon"><Package size={30} /></div>
        <h1 className="pub-hero-title">Your shop is full</h1>
        <p className="pub-hero-text">The Free plan includes {maxProducts} products. You can remove a product to make room, or manage your plan on the Nothi website.</p>
        <Link to="/me" className="pub-btn primary" onClick={() => tap()}>Go to my shop</Link>
      </div>
    );
  }

  if (showIntro) {
    return (
      <div className="pub-page pub-intro">
        <div className="pub-intro-glow" aria-hidden="true" />
        <p className="pub-eyebrow">Become a creator</p>
        <h1 className="pub-hero-title">Turn your presets into income.</h1>
        <p className="pub-hero-text">Thousands of editors are looking for the assets you already use. List one in two minutes.</p>
        <ul className="pub-benefits">
          <li><span><CircleDollarSign size={20} /></span><div><b>You keep ~93%</b><small>5% Nothi fee + payment costs. No monthly fee.</small></div></li>
          <li><span><Wallet size={20} /></span><div><b>Paid straight to your bank</b><small>Secure payouts through Stripe.</small></div></li>
          <li><span><Zap size={20} /></span><div><b>Free assets count too</b><small>Grow your audience and your level.</small></div></li>
        </ul>
        <div className="pub-bottom">
          <button type="button" className="pub-btn primary wide" onClick={() => {
            tap('MEDIUM');
            try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ }
            setIntroDismissed(true);
          }}>
            Create my first product <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (phase && phase !== 'error') {
    const done = phase === 'done';
    const label = { creating: 'Creating your listing…', uploading: 'Uploading your file…', publishing: editing ? 'Saving changes…' : 'Publishing…' }[phase];
    return (
      <div className="pub-page pub-center">
        {done ? (
          <>
            <div className="pub-success"><Check size={40} strokeWidth={3} /></div>
            <h1 className="pub-hero-title">{editing ? 'Changes saved' : "It's live!"}</h1>
            <p className="pub-hero-text">
              {editing ? 'Your product is up to date.' : 'Your product is now on the marketplace. Share it to get your first sales.'}
            </p>
            {boostNote && <p className="pub-note"><AlertCircle size={16} /> {boostNote}</p>}
            {!editing && form.pricing === 'paid' && !profile?.stripe_account_id && !isMockMode && (
              <Link to="/dashboard/payouts" className="pub-callout" onClick={() => tap()}>
                <Wallet size={20} />
                <span><b>Set up payouts</b><small>Connect your bank to receive the money from your sales.</small></span>
                <ChevronRight size={18} />
              </Link>
            )}
            <div className="pub-done-actions">
              <button type="button" className="pub-btn primary wide" onClick={() => { tap(); navigate(`/product/${publishedId}`, { replace: true }); }}>View product</button>
              {!isMockMode && (
                <button type="button" className="pub-btn wide" onClick={() => { tap(); shareLink({ title: form.title, text: `${form.title} on Nothi`, path: `/product/${publishedId}` }); }}>
                  <Share2 size={18} /> Share
                </button>
              )}
              <button type="button" className="pub-btn ghost wide" onClick={() => { tap(); navigate('/me', { replace: true }); }}>Back to my shop</button>
            </div>
          </>
        ) : (
          <>
            <div className="pub-ring" style={{ '--p': phase === 'uploading' ? progress : phase === 'publishing' ? 100 : 8 }}>
              <span>{phase === 'uploading' ? `${progress}%` : <Upload size={26} />}</span>
            </div>
            <h1 className="pub-hero-title small">{label}</h1>
            <p className="pub-hero-text">Keep the app open until it's done.</p>
          </>
        )}
      </div>
    );
  }

  const S = STEPS[step];
  const cover = mediaItems.find((m) => !m.isUploading && m.url);

  return (
    <div className="pub-page">
      {/* progress */}
      <div className="pub-steps" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`pub-step ${i < step ? 'done' : ''} ${i === step ? 'current' : ''}`}
            aria-label={`Step ${i + 1}: ${s.title}`}
            disabled={!editing && i > step}
            onClick={() => { if (editing || i < step) { tap(); go(i); } }}
          />
        ))}
      </div>
      <header className="pub-head">
        <p className="pub-eyebrow">{editing ? 'Edit product' : 'New product'} · Step {step + 1} of {STEPS.length}</p>
        <h1>{S.title}</h1>
        <p>{S.sub}</p>
      </header>

      {/* ── 1. media */}
      {S.id === 'media' && (
        <section className="pub-body pub-media">
          <MediaUploader mediaItems={mediaItems} setMediaItems={setMediaItems} />
          {touched && !mediaReady && <p className="pub-error"><AlertCircle size={15} /> Add at least one image or video.</p>}
          {mediaUploading && <p className="pub-hint">Uploading… you can continue once it's done.</p>}
          <div className="pub-tip"><Sparkles size={16} /> Products with a video preview sell up to 2× more.</div>
        </section>
      )}

      {/* ── 2. file */}
      {S.id === 'file' && (
        <section className="pub-body">
          <input ref={fileInputRef} type="file" className="hidden" onChange={pickFile} />
          {productFile ? (
            <div className="pub-file">
              <span className="pub-file-icon"><FileArchive size={26} /></span>
              <span className="pub-file-meta">
                <b>{productFile.name}</b>
                <small>{(productFile.size / (1024 * 1024)).toFixed(productFile.size > 10 * 1024 * 1024 ? 0 : 1)} MB · ready to upload</small>
              </span>
              <button type="button" className="pub-icon-btn" aria-label="Remove file" onClick={() => { tap(); setProductFile(null); }}><X size={18} /></button>
            </div>
          ) : (
            <button type="button" className={`pub-drop ${fileError || (touched && !fileReady) ? 'error' : ''}`} onClick={() => { tap(); fileInputRef.current?.click(); }}>
              <span className="pub-drop-icon"><Upload size={26} /></span>
              <b>{editing ? 'Replace the file (optional)' : 'Choose your file'}</b>
              <small>.zip, .aep, .prproj, .cube, .mogrt, .mp4… · up to {formatFileSize(maxFileSizeMB)}</small>
            </button>
          )}
          {editing && !productFile && <p className="pub-hint"><Check size={14} /> Your current file stays online unless you replace it.</p>}
          {fileError && <p className="pub-error"><AlertCircle size={15} /> {fileError}</p>}
          {touched && !fileReady && !fileError && <p className="pub-error"><AlertCircle size={15} /> Choose the file buyers will download.</p>}
          <div className="pub-tip"><FileArchive size={16} /> Several files? Put them in one .zip — with a short “read me” for installation.</div>
        </section>
      )}

      {/* ── 3. details */}
      {S.id === 'details' && (
        <section className="pub-body">
          <label className="pub-field">
            <span className="pub-label">Title <em>{form.title.length}/80</em></span>
            <input
              className={`pub-input ${touched && !titleOk ? 'error' : ''}`}
              value={form.title}
              maxLength={80}
              placeholder="e.g. Cinematic Film LUT Pack"
              onChange={(e) => set({ title: e.target.value })}
              enterKeyHint="next"
            />
            {touched && !titleOk && <small className="pub-error">At least 3 characters.</small>}
          </label>
          <label className="pub-field">
            <span className="pub-label">Description</span>
            <textarea
              className={`pub-input pub-textarea ${touched && !descOk ? 'error' : ''}`}
              value={form.description}
              rows={6}
              placeholder="What's included? Which software? How do you install it?"
              onChange={(e) => set({ description: e.target.value })}
            />
            {touched && !descOk ? <small className="pub-error">Tell buyers what they get.</small>
              : <small className="pub-hint">Tip: descriptions over 150 words convert better.</small>}
          </label>
          <div className="pub-field">
            <span className="pub-label">Category</span>
            <Chips options={CATEGORIES.map((c) => ({ value: c.id, label: c.name, icon: c.icon }))} icons={CAT_ICONS} value={form.category} onChange={(v) => set({ category: v })} />
            {touched && !form.category && <small className="pub-error">Pick a category.</small>}
          </div>
          <div className="pub-field">
            <span className="pub-label">Works with <em>choose all that apply</em></span>
            <Chips multiple options={SOFTWARE_LIST.map((s) => ({ value: s, label: s }))} value={form.software} onChange={(v) => set({ software: v })} />
            {touched && form.software.length === 0 && <small className="pub-error">Pick at least one software.</small>}
          </div>
          <div className="pub-field">
            <span className="pub-label">Style</span>
            <Chips multiple options={STYLE_LIST.map((s) => ({ value: s, label: s }))} value={form.style} onChange={(v) => set({ style: v })} />
            {touched && form.style.length === 0 && <small className="pub-error">Pick at least one style.</small>}
          </div>
        </section>
      )}

      {/* ── 4. price */}
      {S.id === 'price' && (
        <section className="pub-body">
          <div className="pub-segment" role="tablist">
            {[['paid', 'Paid'], ['free', 'Free']].map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={form.pricing === v} className={form.pricing === v ? 'on' : ''} onClick={() => { tap(); set({ pricing: v }); }}>{l}</button>
            ))}
          </div>

          {form.pricing === 'paid' ? (
            <>
              <label className={`pub-price ${touched && priceProblem ? 'error' : ''}`}>
                <span>€</span>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => set({ price: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })}
                  aria-label="Price in euros"
                />
              </label>
              {(touched || form.price) && priceProblem && <p className="pub-error center"><AlertCircle size={15} /> {priceProblem}</p>}

              {revenue.gross > 0 && (
                <div className="pub-earn">
                  <div><span>Buyer pays{onSale ? ' (on sale)' : ''}</span><span>{formatEur(revenue.gross)}</span></div>
                  <div><span>Nothi fee (5%)</span><span>−{formatEur(revenue.commission)}</span></div>
                  <div><span>Payment fees (est.)</span><span>−{formatEur(revenue.stripeFee)}</span></div>
                  <div className="total"><span>You earn</span><span>{formatEur(revenue.net)}</span></div>
                  <small>Per sale{onSale ? ` during the promotion (${formatEur(fullRevenue.net)} at full price)` : ''}. Exact payment fees depend on the buyer's card.</small>
                </div>
              )}

              <div className="pub-card">
                <label className="pub-switch-row">
                  <span className="pub-switch-label"><Tag size={18} /> Put it on sale</span>
                  <input type="checkbox" className="pub-switch" checked={form.promoEnabled} onChange={(e) => { tap(); set({ promoEnabled: e.target.checked }); }} />
                </label>
                {form.promoEnabled && (
                  <div className="pub-promo">
                    <label className="pub-field">
                      <span className="pub-label">Sale price (€)</span>
                      <input className={`pub-input ${promoProblem ? 'error' : ''}`} inputMode="decimal" placeholder={`min. ${MIN_SALE_PRICE.toFixed(2)}`} value={form.salePrice}
                        onChange={(e) => set({ salePrice: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} />
                      {promoProblem ? <small className="pub-error">{promoProblem}</small>
                        : parseFloat(form.salePrice) > 0 && priceNum > 0 && <small className="pub-hint">−{Math.round((1 - parseFloat(form.salePrice) / priceNum) * 100)}% for buyers</small>}
                    </label>
                    <label className="pub-field">
                      <span className="pub-label">Ends on <em>optional</em></span>
                      <input className="pub-input" type="date" min={todayInputValue()} value={form.saleEndsAt} onChange={(e) => set({ saleEndsAt: e.target.value })} />
                    </label>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="pub-free">
              <Sparkles size={22} />
              <p><b>Free for everyone.</b> Free assets are a great way to get followers and reviews — buyers come back for your paid ones.</p>
            </div>
          )}

          {PRO && !editing && (
            <div className="pub-card">
              <p className="pub-card-title"><Rocket size={18} /> Boost at launch <em>included with Pro</em></p>
              <div className="pub-boosts">
                {BOOST_PLANS.map((b) => (
                  <button key={b.id} type="button" className={`pub-boost ${boost === b.id ? 'on' : ''}`} onClick={() => { tap(); setBoost(b.id); }}>
                    {b.id === 'none' ? 'None' : b.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 5. review */}
      {S.id === 'review' && (
        <section className="pub-body">
          <div className="pub-preview" aria-hidden="true">
            <ProductCard product={{
              id: editing?.id || 'preview',
              title: form.title || 'Untitled product',
              description: form.description,
              category: form.category || 'packs',
              price: form.pricing === 'paid' ? priceNum || 0 : 0,
              sale_price: form.pricing === 'paid' && form.promoEnabled ? parseFloat(form.salePrice) || null : null,
              media: cover ? [cover] : [],
              software: form.software,
              creator_username: profile?.username,
              creator_avatar: profile?.avatar_url,
              rating: 0,
              reviews_count: 0,
            }} />
          </div>
          <div className="pub-checklist">
            {[
              [0, ImageIcon, 'Visuals', `${mediaItems.filter((m) => m.url).length} added`],
              [1, FileArchive, 'File', productFile ? productFile.name : editing ? 'Current file' : 'Missing'],
              [2, Pencil, 'Details', detailsOk ? CATEGORIES.find((c) => c.id === form.category)?.name : 'Incomplete'],
              [3, CircleDollarSign, 'Price', form.pricing === 'free' ? 'Free' : priceOk ? formatEur(priceNum) : 'Missing'],
            ].map(([i, Icon, label, val]) => (
              <button key={label} type="button" className="pub-check-row" onClick={() => { tap(); go(i); }}>
                <span className={`pub-check ${stepOk[i] ? 'ok' : ''}`}>{stepOk[i] ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}</span>
                <span className="pub-check-label">{label}</span>
                <span className="pub-check-val">{val}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          {phase === 'error' && <p className="pub-error block"><AlertCircle size={16} /> {error}</p>}
          <p className="pub-legal"><Globe size={13} /> By publishing, you confirm you own the rights to this content.</p>
        </section>
      )}

      {/* bottom actions */}
      <div className="pub-bottom">
        {step > 0 && (
          <button type="button" className="pub-btn square" aria-label="Previous step" onClick={() => { tap(); go(step - 1); }}>
            <ArrowLeft size={20} />
          </button>
        )}
        {S.id === 'review' ? (
          <button type="button" className="pub-btn primary wide" disabled={!stepOk[4]} onClick={publish}>
            {editing ? 'Save changes' : phase === 'error' ? 'Try again' : 'Publish'}
          </button>
        ) : (
          <button type="button" className={`pub-btn primary wide ${stepOk[step] ? '' : 'soft'}`} onClick={next}>
            Continue <ArrowRight size={18} />
          </button>
        )}
      </div>

      {/* leave confirmation */}
      {blocker.state === 'blocked' && (
        <div className="pub-sheet-backdrop" onClick={() => blocker.reset()}>
          <div className="pub-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Discard your changes?' : 'Leave without publishing?'}</h2>
            <p>{editing ? 'Your edits will be lost.' : "What you've added so far won't be saved."}</p>
            <button type="button" className="pub-btn danger wide" onClick={() => { tap(); blocker.proceed(); }}>{editing ? 'Discard changes' : 'Leave'}</button>
            <button type="button" className="pub-btn wide" onClick={() => { tap(); blocker.reset(); }}>Keep editing</button>
          </div>
        </div>
      )}
    </div>
  );
}
