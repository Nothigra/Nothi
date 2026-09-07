import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Package, TrendingUp, Users } from 'lucide-react';
import './CreatorCard.css';

const avatarColors = [
  ['#6366F1', '#8B5CF6'], ['#EC4899', '#F43F5E'], ['#F97316', '#EAB308'],
  ['#10B981', '#06B6D4'], ['#3B82F6', '#6366F1'], ['#8B5CF6', '#EC4899']
];

function getAvatarStyle(name) {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const [color1, color2] = avatarColors[hash % avatarColors.length];
  return {
    background: `linear-gradient(135deg, ${color1}, ${color2})`,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: '600'
  };
}

export default function CreatorCard({ creator, rank }) {
  const { t } = useTranslation();

  return (
    <Link to={`/creator/${creator.username}`} className="creator-card">
      {rank && (
        <div className="creator-rank-badge" style={{ backgroundColor: rank.bg, color: rank.color }}>
          {rank.text}
        </div>
      )}
      
      <div className="creator-header">
        <div className="creator-avatar">
          {creator.avatar ? (
            <img src={creator.avatar} alt={creator.name} />
          ) : (
            <div style={{...getAvatarStyle(creator.name), width: '100%', height: '100%'}}>
              {creator.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="creator-info">
          <h3 className="creator-name">
            {creator.name}
            {creator.verified && <CheckCircle size={16} className="verified-icon" />}
          </h3>
          <span className="creator-username">@{creator.username}</span>
        </div>
      </div>

      <p className="creator-bio">{creator.bio}</p>

      <div className="creator-stats">
        <div className="stat-item">
          <TrendingUp size={16} />
          <span>{creator.sales.toLocaleString()} sales</span>
        </div>
        <div className="stat-item">
          <Users size={16} />
          <span>{creator.followers.toLocaleString()} followers</span>
        </div>
        <div className="stat-item">
          <Package size={16} />
          <span>{creator.products} items</span>
        </div>
      </div>
    </Link>
  );
}
