import React from 'react';
import './BadgeIcon.css';

/**
 * Renders a premium, scalable vector badge using CSS shapes and Lucide icons.
 * @param {Object} props
 * @param {Object} props.badge - The badge object from BADGE_CATALOG
 * @param {string} props.size - 'sm' (24px), 'md' (48px), 'lg' (64px)
 * @param {boolean} props.locked - Renders as a silhouette if true
 * @param {boolean} props.interactive - Adds hover scale effects
 * @param {boolean} props.isGlowing - Adds a continuous glowing animation
 */
export default function BadgeIcon({ badge, size = 'md', locked = false, interactive = false, isGlowing = false }) {
  if (!badge) return null;

  const Icon = badge.icon;
  const shape = badge.shape || 'circle';
  const colorVariant = locked ? 'locked' : (badge.colorVariant || 'blue');

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 14,
    md: 20,
    lg: 28,
  };

  const containerClass = `badge-icon-container badge-shape-${shape} badge-color-${colorVariant} ${sizeClasses[size]} ${interactive ? 'interactive' : ''} ${locked ? 'is-locked' : ''} ${isGlowing && !locked ? 'badge-glowing' : ''}`;

  return (
    <div className={containerClass} style={{ overflow: 'hidden' }}>
      <div className="badge-icon-inner flex-center w-full h-full">
        {badge.imageUrl ? (
          <img 
            src={badge.imageUrl} 
            alt={badge.title} 
            className="w-full h-full object-cover" 
            style={{ opacity: locked ? 0.3 : 1, filter: locked ? 'grayscale(100%)' : 'none' }}
          />
        ) : Icon ? (
          <Icon size={iconSizes[size]} className="badge-lucide-icon" strokeWidth={2.5} />
        ) : null}
      </div>
      {/* Glossy overlay effect for premium 3D feel */}
      <div className="badge-glossy-overlay"></div>
    </div>
  );
}
