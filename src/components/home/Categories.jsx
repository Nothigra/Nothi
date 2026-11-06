import { useState, useEffect } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import { Package, Sparkles, FolderArchive, Contrast, Music, MoveRight, LayoutTemplate, TerminalSquare, Layers, ChevronDown } from 'lucide-react';

const MotionLink = motion.create(Link);
const PHONE = '(max-width: 640px)';
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
  const [expanded, setExpanded] = useState(false);
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // Phones start with 6 categories; the rest slide in (and out) on demand.
  const visible = isPhone && !expanded ? categories.slice(0, 6) : categories;

  return (
    <section className="categories-section section">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto var(--space-12) auto' }}>
          <h2>{t('sections.browseCategories', 'Browse by Categories')}</h2>
          <p className="text-muted">{t('sections.browseCategoriesDesc', 'Find the perfect assets for your next video project.')}</p>
        </div>
        
        <div className="categories-grid expanded">
          <AnimatePresence initial={false}>
          {visible.map((category, index) => {
            const Icon = category.icon;
            return (
              <MotionLink 
                key={category.id}
                to={`/marketplace?category=${category.id}`} 
                className="category-card"
                data-index={index}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, delay: index >= 6 ? (index - 6) * 0.05 : 0, ease: [0.16, 1, 0.3, 1] } }}
                exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.18 } }}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                whileTap={{ scale: 0.97 }}
              >
                <div className="category-icon-wrapper">
                  <Icon size={20} className="cat-icon" />
                </div>
                <div className="category-text">
                  <h3 className="category-name">{t(`categories.${category.id}`, category.name)}</h3>
                  <span className="category-desc">{t(`categories.${category.id}Desc`, category.description)}</span>
                </div>
              </MotionLink>
            );
          })}
          </AnimatePresence>
        </div>

        <button
          type="button"
          className={`categories-show-more ${expanded ? 'is-open' : ''}`}
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          {expanded ? t('sections.showFewerCategories', 'Show fewer categories') : t('sections.showMoreCategories', 'Show more categories')}
          <ChevronDown size={16} className="categories-show-more-icon" />
        </button>
      </div>
    </section>
  );
}
