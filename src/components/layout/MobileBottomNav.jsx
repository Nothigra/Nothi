import { Link, useLocation } from 'react-router';
import { Home, Search, Gift, Settings, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './MobileBottomNav.css';

export default function MobileBottomNav() {
  const location = useLocation();
  const { profile, isAuthenticated } = useAuth();

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const profileTarget = isAuthenticated ? '/dashboard' : '/login';
  const settingsTarget = isAuthenticated ? '/dashboard/settings' : '/login';

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      <Link
        to="/"
        className={`mbn-item ${isActive('/', true) ? 'active' : ''}`}
        aria-label="Home"
      >
        <Home size={22} strokeWidth={isActive('/', true) ? 2.4 : 2} />
        <span>Home</span>
      </Link>

      <Link
        to="/marketplace"
        className={`mbn-item ${isActive('/marketplace') ? 'active' : ''}`}
        aria-label="Marketplace"
      >
        <Search size={22} strokeWidth={isActive('/marketplace') ? 2.4 : 2} />
        <span>Marketplace</span>
      </Link>

      <Link
        to={profileTarget}
        className="mbn-item mbn-center"
        aria-label="Profile"
      >
        <span className={`mbn-center-avatar ${isActive('/dashboard') ? 'active' : ''}`}>
          {isAuthenticated && profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            <User size={20} strokeWidth={2} />
          )}
        </span>
        <span>Profile</span>
      </Link>

      <Link
        to="/rewards"
        className={`mbn-item ${isActive('/rewards') ? 'active' : ''}`}
        aria-label="Rewards"
      >
        <Gift size={22} strokeWidth={isActive('/rewards') ? 2.4 : 2} />
        <span>Rewards</span>
      </Link>

      <Link
        to={settingsTarget}
        className={`mbn-item ${isActive('/dashboard/settings') ? 'active' : ''}`}
        aria-label="Settings"
      >
        <Settings size={22} strokeWidth={isActive('/dashboard/settings') ? 2.4 : 2} />
        <span>Settings</span>
      </Link>
    </nav>
  );
}
