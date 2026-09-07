import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Star, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { getTopSellers } from '../api/leaderboardApi';
import { useAuth } from '../context/AuthContext';
import './BestSellersPage.css';

export default function BestSellersPage() {
  const { t } = useTranslation();
  const { profile, isMockMode } = useAuth();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination for leaderboard
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getTopSellers(false, isMockMode);
        setCreators(data);
      } catch (error) {
        console.error("Failed to load top sellers:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="container section flex-center" style={{ minHeight: '60vh' }}>
        <div className="loader spin"></div>
      </div>
    );
  }

  const podiumCreators = creators.slice(0, 3);
  // Re-order podium for visual display: 2nd, 1st, 3rd
  const displayPodium = [];
  if (podiumCreators[1]) displayPodium.push(podiumCreators[1]);
  if (podiumCreators[0]) displayPodium.push(podiumCreators[0]);
  if (podiumCreators[2]) displayPodium.push(podiumCreators[2]);

  const leaderboardCreators = creators.slice(3);
  const totalPages = Math.ceil(leaderboardCreators.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const visibleCreators = leaderboardCreators.slice(startIndex, startIndex + rowsPerPage);

  const isCurrentUser = (username) => profile?.username === username;

  return (
    <div className="bestsellers-page container section">
      <div className="bestsellers-header text-center mb-16">
        <h1 className="page-title text-4xl font-bold mb-4">{t('nav.bestSellers', 'Top Creators')}</h1>
        <p className="page-subtitle text-secondary max-w-2xl mx-auto">
          {t('bestsellers.subtitle', 'The most successful creators on Nothi, ranked by all-time performance.')}
        </p>
      </div>

      {/* Podium Section (Top 3) */}
      {displayPodium.length > 0 && (
        <div className="podium-container">
          {displayPodium.map((creator) => {
            const isGold = creator.rank === 1;
            const rankClass = isGold ? 'gold' : creator.rank === 2 ? 'silver' : 'bronze';
            const blockClass = isGold ? 'gold-block' : creator.rank === 2 ? 'silver-block' : 'bronze-block';
            const me = isCurrentUser(creator.username);

            return (
              <motion.div 
                key={creator.id}
                className={`podium-column podium-rank-${creator.rank}`}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: creator.rank * 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="podium-avatar-wrapper">
                  <img 
                    src={creator.avatar_url || `https://ui-avatars.com/api/?name=${creator.name}&background=random`} 
                    alt={creator.name} 
                    className={`podium-avatar ${me ? 'border-accent shadow-[0_0_15px_var(--color-accent)]' : ''}`} 
                  />
                  <div className={`elite-rank-badge ${rankClass}-text`}>
                    {isGold ? <Crown size={14} /> : creator.rank}
                  </div>
                </div>
                
                <Link to={`/creator/${creator.username}`} className="text-center mb-4 hover:opacity-80 transition-opacity">
                  <h3 className={`font-bold text-sm md:text-lg truncate w-24 md:w-full ${me ? 'text-accent' : ''}`}>{creator.name}</h3>
                  <span className="text-xs md:text-sm text-secondary">@{creator.username}</span>
                </Link>

                <div className={`podium-block ${blockClass} ${me ? 'bg-accent-subtle border-t-2 border-x-2 border-accent' : ''}`}>
                  <span className="base-number opacity-20">{creator.rank}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Leaderboard Section (Ranks 4-50) */}
      <div className="leaderboard-section max-w-4xl mx-auto">
        <div className="leaderboard-header grid grid-cols-[60px_1fr_100px] md:grid-cols-[80px_1fr_100px_100px] gap-4 p-4 border-b border-border text-sm font-semibold text-secondary">
          <div className="text-center">Rank</div>
          <div>Creator</div>
          <div className="hidden md:block text-center">Level</div>
          <div className="text-right">Profile</div>
        </div>
        
        <motion.div 
          className="leaderboard-list flex flex-col gap-2 mt-4"
          initial="show"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {visibleCreators.map((creator) => {
            const me = isCurrentUser(creator.username);
            return (
              <div 
                key={creator.id} 
                className={`leaderboard-row grid grid-cols-[60px_1fr_100px] md:grid-cols-[80px_1fr_100px_100px] items-center gap-4 p-4 rounded-xl transition-all ${me ? 'bg-accent-subtle border-2 border-accent' : 'bg-bg-card border border-border hover:border-border-strong'}`}
              >
                <div className="text-center font-black text-xl text-tertiary">
                  {creator.rank}
                </div>
                
                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                  <img 
                    src={creator.avatar_url || `https://ui-avatars.com/api/?name=${creator.name}&background=random`} 
                    alt={creator.name} 
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" 
                  />
                  <div className="flex flex-col truncate">
                    <span className={`font-bold truncate ${me ? 'text-accent' : 'text-primary'}`}>{creator.name}</span>
                    <span className="text-xs md:text-sm text-secondary truncate">@{creator.username}</span>
                  </div>
                </div>
                
                <div className="hidden md:flex justify-center">
                  <div className="px-3 py-1 bg-bg-secondary text-secondary rounded-full text-xs font-semibold">
                    Lvl {creator.level}
                  </div>
                </div>
                
                <div className="text-right">
                  <Link to={`/creator/${creator.username}`} className={`btn btn-sm ${me ? 'btn-primary' : 'btn-outline'}`}>
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </motion.div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-8 p-4">
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="text-sm text-secondary font-medium">Page {currentPage} of {totalPages}</span>
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
