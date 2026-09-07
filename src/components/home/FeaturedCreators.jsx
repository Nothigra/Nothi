import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Star, Users, Package } from 'lucide-react';
import { creators } from '../../data';
import { formatNumber } from '../../utils/helpers';
import './FeaturedCreators.css';

export default function FeaturedCreators() {
  const { t } = useTranslation();
  
  // Get top 3 creators
  const topCreators = creators.slice(0, 3);

  return (
    <section className="featured-creators">
      <div className="container">
        <div className="section-header text-center">
          <div className="section-badge mx-auto">
            <Star size={16} className="badge-icon" fill="currentColor" />
            <span>{t('sections.featuredCreators')}</span>
          </div>
          <h2 className="section-title">{t('sections.featuredCreators')}</h2>
          <p className="section-desc">{t('sections.featuredCreatorsDesc')}</p>
        </div>

        <div className="creators-grid">
          {topCreators.map(creator => (
            <Link key={creator.id} to={`/creator/${creator.username}`} className="creator-card glass-card">
              <div className="creator-header">
                <div className="creator-avatar-large">
                  {creator.name.charAt(0)}
                </div>
                <div className="creator-info">
                  <h3 className="creator-name">{creator.name}</h3>
                  <span className="creator-username">@{creator.username}</span>
                </div>
              </div>
              
              <p className="creator-bio text-muted">{creator.bio}</p>
              
              <div className="creator-stats">
                <div className="stat-item">
                  <Package size={16} className="stat-icon" />
                  <div className="stat-details">
                    <span className="stat-value">{creator.products}</span>
                    <span className="stat-label">{t('dashboard.products')}</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Users size={16} className="stat-icon" />
                  <div className="stat-details">
                    <span className="stat-value">{formatNumber(creator.followers)}</span>
                    <span className="stat-label">{t('profile.followers')}</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Star size={16} className="stat-icon" fill="currentColor" style={{ color: '#F59E0B' }}/>
                  <div className="stat-details">
                    <span className="stat-value">{creator.rating}</span>
                    <span className="stat-label">{t('marketplace.rating')}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
