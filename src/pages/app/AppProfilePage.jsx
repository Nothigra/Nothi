import { Link, useNavigate } from 'react-router';
import {
  LayoutDashboard, Package, Plus, BarChart3, Wallet, Heart, Users, Gift, Award, Bell,
  Crown, Settings, Moon, Sun, Info, Mail, FileText, Shield, LogOut, ChevronRight, Store,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useGamification } from '../../context/GamificationContext';
import ProBadge from '../../components/common/ProBadge';
import { isPro } from '../../config/plans';
import { tap, platform } from '../../lib/native';
import './AppPages.css';

function Row({ to, icon: Icon, label, hint, onClick, danger }) {
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

function Group({ title, children }) {
  return (
    <section className="app-group">
      {title && <h3 className="app-group-title">{title}</h3>}
      <div className="app-group-card">{children}</div>
    </section>
  );
}

export default function AppProfilePage() {
  const { profile, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { gamificationState } = useGamification();
  const navigate = useNavigate();
  const dark = theme !== 'light';
  const pro = isPro(profile);

  const themeRow = (
    <Row icon={dark ? Moon : Sun} label="Appearance" hint={dark ? 'Dark' : 'Light'} onClick={() => setTheme(dark ? 'light' : 'dark')} />
  );

  if (!isAuthenticated) {
    return (
      <div className="app-page">
        <div className="app-hero-card guest">
          <img src="/logo.png" alt="" className="app-profile-logo" />
          <h2>Join Nothi</h2>
          <p>Save your favourites, get your assets on every device, and open your own shop.</p>
          <Link to="/login" className="btn btn-primary app-hero-btn" onClick={() => tap()}>Sign in or create an account</Link>
        </div>
        <Group title="Explore">
          <Row to="/best-sellers" icon={Award} label="Top creators" />
          <Row to="/rewards" icon={Gift} label="Rewards" />
        </Group>
        <Group title="App">{themeRow}</Group>
        <Group title="About">
          <Row to="/about" icon={Info} label="About Nothi" />
          <Row to="/contact" icon={Mail} label="Contact" />
          <Row to="/terms" icon={FileText} label="Terms" />
          <Row to="/privacy" icon={Shield} label="Privacy" />
        </Group>
        <p className="app-version">Nothi for {platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'mobile'} · 1.0</p>
      </div>
    );
  }

  const level = gamificationState?.level || profile?.level || 1;

  return (
    <div className="app-page">
      <div className="app-hero-card">
        <span className="app-hero-avatar">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.username || '?').charAt(0).toUpperCase()}
        </span>
        <div className="app-hero-meta">
          <h2>{profile?.username} {pro && profile?.show_pro_badge !== false && <ProBadge size={18} />}</h2>
          <p>Level {level}{gamificationState?.streak ? ` · ${gamificationState.streak}-day streak` : ''}</p>
        </div>
        <Link to={`/creator/${profile?.username}`} className="app-hero-shop" onClick={() => tap()}>
          <Store size={16} /> My shop
        </Link>
      </div>

      <Group title="Selling">
        <Row to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <Row to="/dashboard/products" icon={Package} label="My products" />
        <Row to="/dashboard/upload" icon={Plus} label="Publish a product" />
        <Row to="/dashboard/analytics" icon={BarChart3} label="Analytics" />
        <Row to="/dashboard/payouts" icon={Wallet} label="Earnings & payouts" />
      </Group>

      <Group title="Activity">
        <Row to="/dashboard/wishlist" icon={Heart} label="Wishlist" />
        <Row to="/dashboard/following" icon={Users} label="Following" />
        <Row to="/notifications" icon={Bell} label="Notifications" />
        <Row to="/rewards" icon={Gift} label="Rewards" />
        <Row to="/dashboard/badges" icon={Award} label="Badges" />
      </Group>

      <Group title="Account">
        <Row to="/dashboard/subscription" icon={Crown} label="Plan" hint={pro ? 'Pro' : 'Free'} />
        <Row to="/dashboard/settings" icon={Settings} label="Settings" />
        {themeRow}
      </Group>

      <Group title="About">
        <Row to="/about" icon={Info} label="About Nothi" />
        <Row to="/contact" icon={Mail} label="Contact" />
        <Row to="/terms" icon={FileText} label="Terms" />
        <Row to="/privacy" icon={Shield} label="Privacy" />
      </Group>

      <Group>
        <Row icon={LogOut} label="Sign out" danger onClick={async () => { await logout(); navigate('/', { replace: true }); }} />
      </Group>

      <p className="app-version">Nothi for {platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'mobile'} · 1.0</p>
    </div>
  );
}
