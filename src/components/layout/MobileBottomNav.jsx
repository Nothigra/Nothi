import { Link, useLocation } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { Home, Search, Gift, Settings, User, Trophy, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './MobileBottomNav.css';

export default function MobileBottomNav() {
  const location = useLocation();
  const { profile, isAuthenticated } = useAuth();
  const [isCompact, setIsCompact] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const lastScrollY = useRef(0);
  const moreRef = useRef(null);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      // Ignore tiny jitters (rubber-banding, sub-pixel scroll noise)
      if (Math.abs(delta) < 4) return;

      if (currentY <= 40) {
        // Always fully visible right at the top of the page
        setIsCompact(false);
      } else if (delta > 0) {
        // Scrolling down -> tuck the bar away
        setIsCompact(true);
      } else {
        // Scrolling up -> bring it back
        setIsCompact(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the Settings/Best Sellers popover on outside tap or route change
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleOutside = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [isMoreOpen]);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const profileTarget = isAuthenticated ? '/dashboard' : '/login';
  const settingsTarget = isAuthenticated ? '/dashboard/settings' : '/login';
  const isMoreActive = isActive('/dashboard/settings') || isActive('/best-sellers');

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

      <div className="mbn-more-wrapper" ref={moreRef}>
        {isMoreOpen && (
          <div className="mbn-popover">
            <Link to={settingsTarget} className="mbn-popover-item" onClick={() => setIsMoreOpen(false)}>
              <Settings size={17} /> Settings
            </Link>
            <Link to="/best-sellers" className="mbn-popover-item" onClick={() => setIsMoreOpen(false)}>
              <Trophy size={17} /> Best Sellers
            </Link>
          </div>
        )}
        <button
          type="button"
          className={`mbn-item ${isMoreActive || isMoreOpen ? 'active' : ''}`}
          aria-label="More"
          onClick={() => setIsMoreOpen(v => !v)}
        >
          {isMoreOpen ? <ChevronUp size={21} strokeWidth={2.4} /> : <Settings size={21} strokeWidth={isMoreActive ? 2.4 : 2} />}
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
