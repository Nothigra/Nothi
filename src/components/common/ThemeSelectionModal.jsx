import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ThemeCard from './ThemeCard';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import './ThemeSelectionModal.css';

export default function ThemeSelectionModal() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only evaluate once auth has finished resolving
    if (isLoading) return;

    // Do not show for logged in users (they get it in onboarding or settings)
    if (isAuthenticated) return;

    // Check if the user has already made a selection
    const hasSelected = localStorage.getItem('digilab-theme-selected');
    if (!hasSelected) {
      setIsOpen(true);
      // Lock scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }
  }, [isLoading, isAuthenticated]);

  const handleSelect = (selectedTheme) => {
    setTheme(selectedTheme);
    localStorage.setItem('digilab-theme-selected', 'true');
    setIsOpen(false);
    document.body.style.overflow = '';
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="theme-modal-overlay">
      <div className="theme-modal-card">
        <div className="theme-modal-header">
          <h2 className="theme-modal-title">Pick your look</h2>
          <p className="theme-modal-subtitle">Choose how you want to experience Nothi. You can change this anytime.</p>
        </div>
        
        <div className="theme-modal-body">
          <div className="theme-modal-grid">
            <ThemeCard themeKey="light" isSelected={theme === 'light'} onSelect={handleSelect} />
            <ThemeCard themeKey="dim" isSelected={theme === 'dim'} onSelect={handleSelect} />
            <ThemeCard themeKey="dark" isSelected={theme === 'dark'} onSelect={handleSelect} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
