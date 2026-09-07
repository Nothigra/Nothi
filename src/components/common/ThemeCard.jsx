import { Sun, Moon } from 'lucide-react';
import './ThemeCard.css';

export default function ThemeCard({ themeKey, isSelected, onSelect }) {
  return (
    <button
      className={`theme-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(themeKey)}
    >
      {themeKey === 'light' ? (
        <Sun size={32} />
      ) : themeKey === 'dim' ? (
        <Moon size={32} opacity={0.5} />
      ) : (
        <Moon size={32} />
      )}
      <span className="card-title">
        {themeKey === 'light' ? 'Light Mode' : themeKey === 'dim' ? 'Dim Mode' : 'Dark Mode'}
      </span>
    </button>
  );
}
