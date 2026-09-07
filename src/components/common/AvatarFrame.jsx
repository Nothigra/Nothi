import React from 'react';
import './AvatarFrame.css';

/**
 * AvatarFrame wraps a user's profile picture with a gamified border/glow based on their tier.
 * CRITICAL: Receives only scalar string props (tier, imageUrl). Never pass the raw user object.
 * 
 * @param {Object} props
 * @param {string} props.tier - 'bronze', 'silver', 'gold', 'platinum'
 * @param {string} props.imageUrl - The URL of the avatar image
 * @param {string} props.size - Size variant ('sm', 'md', 'lg', 'xl')
 * @param {boolean} props.animatePulse - Whether to play a one-time glow/pulse animation
 */
export default function AvatarFrame({ tier = 'bronze', imageUrl, size = 'md', animatePulse = false, fallbackLetter = '?' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-40 h-40',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  const renderAvatar = () => {
    if (imageUrl) {
      return <img src={imageUrl} alt="Avatar" className="avatar-frame-img" />;
    }
    // Generic fallback if no image provided to protect privacy
    return (
      <div className="avatar-frame-placeholder flex-center bg-bg-tertiary w-full h-full rounded-full text-secondary">
        {fallbackLetter}
      </div>
    );
  };

  return (
    <div className={`avatar-frame-container size-${size} frame-tier-${tier} ${animatePulse ? 'new-unlock-pulse' : ''}`}>
      <div className={`avatar-frame-wrapper ${selectedSize}`}>
        {renderAvatar()}
        <div className="avatar-frame-border"></div>
      </div>
    </div>
  );
}
