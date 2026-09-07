import { motion } from 'framer-motion';
import { User, CheckCircle, Clock, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import './ContactPage.css'; // Reuse static page layout classes
import './AboutPage.css';

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="static-page">
      <div className="static-header">
        <motion.h1 
          className="static-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {t('aboutUs.title', 'About Us')}
        </motion.h1>
      </div>

      <motion.div 
        className="about-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="about-avatar-wrapper">
          {/* Fallback avatar if real image is missing */}
          <div className="about-avatar-placeholder">
            <User size={64} />
          </div>
          {/* Note: When adding an actual image, place it here.
          <img src="/avatar-nothigra.jpg" alt="Nothigra" className="about-avatar" /> */}
        </div>
        
        <div className="about-profile-info">
          <h2 className="about-name">Noah Thirion</h2>
          <div className="about-handle">@Nothigra</div>
        </div>

        <div className="about-stats">
          <div className="about-stat-badge">
            <Clock size={14} />
            {t('aboutUs.statsYears', '6+ years editing')}
          </div>
          <div className="about-stat-badge">
            <PlayCircle size={14} />
            {t('aboutUs.statsTutorials', 'TikTok & YouTube tutorials')}
          </div>
        </div>

        <div className="about-socials">
          {/* TODO: replace with real TikTok/YouTube profile URLs */}
          <a href="#" className="about-social-link" aria-label="YouTube">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.42a2.78 2.78 0 0 0-1.94 2C1 8.13 1 12 1 12s0 3.87.46 5.58a2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.42a2.78 2.78 0 0 0 1.94-2C23 15.87 23 12 23 12s0-3.87-.46-5.58z"></path>
              <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon>
            </svg>
          </a>
          {/* Using a simple custom SVG for TikTok since Lucide doesn't have it built-in */}
          <a href="#" className="about-social-link" aria-label="TikTok">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
            </svg>
          </a>
        </div>

        <div className="about-text">
          <p>
            {t('aboutUs.content1')}
          </p>
          <p>
            {t('aboutUs.content2')}
          </p>
        </div>

        <Link to="/marketplace" className="btn btn-primary btn-lg mt-md">
          {t('aboutUs.ctaMarketplace', 'Explore the Marketplace')}
        </Link>
      </motion.div>
    </div>
  );
}
