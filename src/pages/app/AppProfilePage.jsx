import { useState } from 'react';
import { Link } from 'react-router';
import { Award, Gift, Info, Mail, FileText, Shield, ChevronRight, Moon, Sun, Share2, Store, Pencil, Flame } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useGamification } from '../../context/GamificationContext';
import ProBadge from '../../components/common/ProBadge';
import { isPro } from '../../config/plans';
import { tap, platform, shareLink } from '../../lib/native';
import AppShopPanel from './AppShopPanel';
import AppLibraryPanel from './AppLibraryPanel';
import './AppPages.css';

export function Row({ to, icon: Icon, label, hint, onClick, danger }) {
  const inner = (
    <>
      <span className={`app-row-icon ${danger ? 'danger' : ''}`}><Icon size={18} /></span>
      <span className="app-row-label">{label}</span>
      {hint && <span className="app-row-hint">{hint}</span>}
      {to && <ChevronRight size={18} className="app-row-chev" />}
    </>
  );
  if (to) return <Link to={to} className="app-row" onClick={() => tap()}>{inner}</Link>;
  return <button type="button" className={`app-row ${danger ? 'danger' : ''}`} onClick={() => { tap(); onClick?.(); }}>{inner}</button>;
}

export function Group({ title, children }) {
  return (
    <section className="app-group">
      {title && <h3 className="app-group-title">{title}</h3>}
      <div className="app-group-card">{children}</div>
    </section>
  );
}

export const versionLine = `Nothi for ${platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'mobile'} · 1.1`;

const SEG_KEY = 'nothi-profile-segment';

export default function AppProfilePage() {
  const { profile, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const { gamificationState } = useGamification();
  const dark = theme !== 'light';
  const pro = isPro(profile);
  const [segment, setSegment] = useState(() => {
    try { return localStorage.getItem(SEG_KEY) || 'shop'; } catch { return 'shop'; }
  });
  const choose = (s) => { tap(); setSegment(s); try { localStorage.setItem(SEG_KEY, s); } catch { /* ignore */ } };

  if (!isAuthenticated) {
    return (
      <div className="app-page">
        <div className="app-hero-card guest">
          <img src="/logo.png" alt="" className="app-profile-logo" />
          <h2>Join Nothi</h2>
          <p>Get your assets on every device, follow creators — and open your own shop.</p>
          <Link to="/login" className="btn btn-primary app-hero-btn" onClick={() => tap()}>Sign in or create an account</Link>
        </div>
        <Group title="Explore">
          <Row to="/best-sellers" icon={Award} label="Top creators" />
          <Row to="/rewards" icon={Gift} label="Rewards" />
        </Group>
        <Group title="App">
          <Row icon={dark ? Moon : Sun} label="Appearance" hint={dark ? 'Dark' : 'Light'} onClick={() => setTheme(dark ? 'light' : 'dark')} />
        </Group>
        <Group title="About">
          <Row to="/about" icon={Info} label="About Nothi" />
          <Row to="/contact" icon={Mail} label="Contact" />
          <Row to="/terms" icon={FileText} label="Terms" />
          <Row to="/privacy" icon={Shield} label="Privacy" />
        </Group>
        <p className="app-version">{versionLine}</p>
      </div>
    );
  }

  const level = gamificationState?.level || profile?.level || 1;
  const streak = gamificationState?.streak || 0;

  return (
    <div className="app-page app-profile">
      <header className="app-me">
        <span className="app-me-avatar">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.username || '?').charAt(0).toUpperCase()}
        </span>
        <div className="app-me-meta">
          <h2>{profile?.username} {pro && profile?.show_pro_badge !== false && <ProBadge size={18} />}</h2>
          <p>
            <span className="app-me-chip">Level {level}</span>
            {streak > 0 && <span className="app-me-chip"><Flame size={13} /> {streak} days</span>}
            {pro && <span className="app-me-chip">Pro</span>}
          </p>
        </div>
      </header>
      <div className="app-me-actions">
        <Link to={`/creator/${profile?.username}`} className="app-pill-btn" onClick={() => tap()}><Store size={17} /> My page</Link>
        <Link to="/dashboard/settings" className="app-pill-btn" onClick={() => tap()}><Pencil size={16} /> Edit profile</Link>
        <button type="button" className="app-pill-btn square" aria-label="Share my page" onClick={() => { tap(); shareLink({ title: profile?.username, text: `${profile?.username} on Nothi`, path: `/creator/${profile?.username}` }); }}>
          <Share2 size={17} />
        </button>
      </div>

      <div className="app-segment" role="tablist">
        <button type="button" role="tab" aria-selected={segment === 'shop'} className={segment === 'shop' ? 'on' : ''} onClick={() => choose('shop')}>My shop</button>
        <button type="button" role="tab" aria-selected={segment === 'library'} className={segment === 'library' ? 'on' : ''} onClick={() => choose('library')}>Library</button>
        <span className="app-segment-thumb" style={{ transform: segment === 'library' ? 'translateX(100%)' : 'none' }} aria-hidden="true" />
      </div>

      <div key={segment} className="app-segment-panel">
        {segment === 'shop' ? <AppShopPanel /> : <AppLibraryPanel />}
      </div>
    </div>
  );
}
