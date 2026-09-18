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
      ) : (
        <Moon size={32} />
      )}
      <span className="card-title">
        {themeKey === 'light' ? 'Light Mode' : 'Dark Mode'}
      </span>
    </button>
  );
}
