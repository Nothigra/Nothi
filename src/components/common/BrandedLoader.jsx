import React from 'react';
import './BrandedLoader.css';

export default function BrandedLoader({ isExiting = false }) {
  return (
    <div className={`branded-loader-container ${isExiting ? 'exiting' : ''}`}>
      <div className="branded-loader-content">
        <div className="branded-spinner"></div>
      </div>
    </div>
  );
}
