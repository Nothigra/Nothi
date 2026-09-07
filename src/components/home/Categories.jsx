import { Link } from 'react-router';
import { Package, Sparkles, FolderArchive, Contrast, Music, MoveRight, LayoutTemplate, TerminalSquare, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './Categories.css';

const categories = [
  { id: 'packs', name: 'Packs', icon: Package, description: 'Bundles & Kits', color: '#3b82f6' }, // Blue
  { id: 'effects', name: 'Effects', icon: Sparkles, description: 'Visual Effects', color: '#8b5cf6' }, // Purple
  { id: 'projects', name: 'Project Files', icon: FolderArchive, description: 'Open Source', color: '#06b6d4' }, // Cyan
  { id: 'luts', name: 'LUTs', icon: Contrast, description: 'Color Grading', color: '#f97316' }, // Orange
  { id: 'sfx', name: 'SFX', icon: Music, description: 'Sound Effects', color: '#ec4899' }, // Pink
  { id: 'transitions', name: 'Transitions', icon: MoveRight, description: 'Scene Changes', color: '#6366f1' }, // Indigo
  { id: 'templates', name: 'Templates', icon: LayoutTemplate, description: 'Ready to Use', color: '#14B8A6' }, // Teal
  { id: 'scripts', name: 'Scripts', icon: TerminalSquare, description: 'Automation', color: '#F59E0B' }, // Amber
  { id: 'overlays', name: 'Overlays', icon: Layers, description: 'Light Leaks', color: '#10B981' }, // Emerald
];

export default function Categories() {
  const { t } = useTranslation();
  return (
    <section className="categories-section section">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto var(--space-12) auto' }}>
          <h2>{t('sections.browseCategories', 'Browse by Categories')}</h2>
          <p className="text-muted">{t('sections.browseCategoriesDesc', 'Find the perfect assets for your next video project.')}</p>
        </div>
        
        <div className="categories-grid">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link 
                key={category.id}
                to={`/marketplace?category=${category.id}`} 
                className="category-card"
                style={{ '--cat-color': category.color }}
              >
                <div className="category-icon-wrapper">
                  <Icon size={20} className="cat-icon" />
                </div>
                <div className="category-text">
                  <h3 className="category-name">{t(`categories.${category.id}`, category.name)}</h3>
                  <span className="category-desc">{t(`categories.${category.id}Desc`, category.description)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
