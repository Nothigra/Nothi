import { Link, useLocation } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { Home, Search, Gift, Settings, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './MobileBottomNav.css';

export default function MobileBottomNav() {
  const location = useLocation();
  const { profile, isAuthenticated } = useAuth();
  const [isCompact, setIsCompact] = useState(false);
  const scrollTimer = useRef(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = Math.abs(currentY - lastScrollY.current);
      lastScrollY.current = currentY;

      // Ignore tiny/rubber-band jitters near the very top of the page
      if (currentY > 40 && delta > 4) {
        setIsCompact(true);
      }

      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        setIsCompact(false);
      }, 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const profileTarget = isAuthenticated ? '/dashboard' : '/login';
  const settingsTarget = isAuthenticated ? '/dashboard/settings' : '/login';

  return (
    <nav className={`mobile-bottom-nav ${isCompact ? 'compact' : ''}`} aria-label="Primary">
      <Link
        to="/"
        className={`mbn-item ${isActive('/', true) ? 'active' : ''}`}
        aria-label="Home"
      >
        <Home size={21} strokeWidth={isActive('/', true) ? 2.4 : 2} />
        <span>Home</span>
      </Link>

      <Link
        to="/marketplace"
        className={`mbn-item ${isActive('/marketplace') ? 'active' : ''}`}
        aria-label="Marketplace"
      >
        <Search size={21} strokeWidth={isActive('/marketplace') ? 2.4 : 2} />
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
            <User size={19} strokeWidth={2} />
          )}
        </span>
        <span>Profile</span>
      </Link>

      <Link
        to="/rewards"
        className={`mbn-item ${isActive('/rewards') ? 'active' : ''}`}
        aria-label="Rewards"
      >
        <Gift size={21} strokeWidth={isActive('/rewards') ? 2.4 : 2} />
        <span>Rewards</span>
      </Link>

      <Link
        to={settingsTarget}
        className={`mbn-item ${isActive('/dashboard/settings') ? 'active' : ''}`}
        aria-label="Settings"
      >
        <Settings size={21} strokeWidth={isActive('/dashboard/settings') ? 2.4 : 2} />
        <span>Settings</span>
      </Link>
    </nav>
  );
}
