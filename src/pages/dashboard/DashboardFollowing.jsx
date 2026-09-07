import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MOCK_CREATORS } from '../../lib/seed';
import { Link, useNavigate } from 'react-router';
import { Users, UserMinus, Store } from 'lucide-react';
import AvatarFrame from '../../components/common/AvatarFrame';
import { getPublicProducts } from '../../api/productApi';

export default function DashboardFollowing() {
  const { profile, unfollowCreator, isMockMode } = useAuth();
  const navigate = useNavigate();
  const [followedCreators, setFollowedCreators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile?.following) {
        setFollowedCreators([]);
        setIsLoading(false);
        return;
      }
      
      const allProducts = await getPublicProducts(isMockMode);
      
      const mapped = profile.following.map(f => {
        const creator = MOCK_CREATORS.find(c => c.id === f.creatorId);
        if (!creator) return null;
        
        const creatorProducts = allProducts.filter(p => p.creator_id === creator.id || p.seller_id === creator.id);
        let hasNewProduct = false;
        
        if (creatorProducts.length > 0 && f.lastViewedAt) {
          const maxDate = Math.max(...creatorProducts.map(p => new Date(p.created_at || 0).getTime()));
          hasNewProduct = maxDate > new Date(f.lastViewedAt).getTime();
        } else if (creatorProducts.length > 0 && !f.lastViewedAt) {
          hasNewProduct = true;
        }
        return { ...creator, hasNewProduct, lastViewedAt: f.lastViewedAt };
      }).filter(Boolean);
      
      setFollowedCreators(mapped);
      setIsLoading(false);
    }
    loadData();
  }, [profile?.following, isMockMode]);

  if (isLoading) {
    return <div className="dashboard-page pb-2xl flex-center py-2xl"><div className="loader spin"></div></div>;
  }

  return (
    <div className="dashboard-page pb-2xl">
      <div className="dashboard-page-header">
        <div>
          <h1 className="dashboard-title">Following</h1>
          <p className="dashboard-subtitle">Creators you subscribe to.</p>
        </div>
      </div>

      {followedCreators.length === 0 ? (
        <div className="premium-empty-state max-w-2xl mt-xl">
          <div className="empty-illustration">
            <Users size={48} />
          </div>
          <h3 className="text-xl font-bold mb-xs">Not following anyone yet</h3>
          <p className="text-secondary mb-lg">Follow your favorite creators to stay updated on their latest products.</p>
          <Link to="/marketplace" className="btn btn-primary">
            Explore Creators
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-xl mt-xl">
          {followedCreators.map(creator => (
            <div 
              key={creator.id} 
              className="glass-card p-xl flex flex-col items-center text-center relative group transition-transform hover:-translate-y-1 cursor-pointer"
              onClick={() => navigate(`/creator/${creator.username}`)}
            >
              {creator.hasNewProduct && (
                <div 
                  className="absolute top-sm right-sm w-3 h-3 bg-red-500 rounded-full shadow-md animate-pulse" 
                  title="New product available!"
                />
              )}
              
              <Link to={`/creator/${creator.username}`} className="relative mb-md block">
                <AvatarFrame tier={creator.tier} imageUrl={creator.avatar_url} size="lg" />
              </Link>
              
              <Link to={`/creator/${creator.username}`} className="font-bold text-lg hover:text-accent transition-colors">
                {creator.name || creator.username}
              </Link>
              
              <div className="text-sm text-secondary mb-lg line-clamp-2 min-h-[40px]">
                {creator.bio || 'Digital Creator'}
              </div>

              <div className="flex gap-sm w-full mt-auto pt-md border-t border-border">
                <Link 
                  to={`/creator/${creator.username}`} 
                  className="btn btn-outline flex-1 flex-center gap-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Store size={14} /> Shop
                </Link>
                <button 
                  className="btn btn-outline border-border hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors flex-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    unfollowCreator(creator.id);
                  }}
                  title="Unfollow"
                  style={{ width: '40px', padding: 0 }}
                >
                  <UserMinus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
