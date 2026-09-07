import React, { useState, useEffect } from 'react';
import { Shield, Search, Check, Plus, Minus, GripVertical } from 'lucide-react';
import { BADGE_CATALOG } from '../../api/gamificationApi';
import { useGamification } from '../../context/GamificationContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BadgeIcon from '../../components/common/BadgeIcon';
import Input from '../../components/ui/Input';
import './DashboardBadges.css';

export default function DashboardBadges() {
  const { gamificationState, markBadgesSeen } = useGamification();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    markBadgesSeen();
  }, [markBadgesSeen]);

  if (!gamificationState) {
    return <div className="flex-center h-full min-h-[400px]"><div className="loader spin"></div></div>;
  }

  const unlockedBadges = gamificationState.unlockedBadges || [];

  // Future scalability: searching and filtering
  const filteredBadges = BADGE_CATALOG.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || b.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="dashboard-badges-page pb-3xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-xl gap-md">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-sm mb-xs">
            <Shield size={32} className="text-accent" />
            My Badges
          </h1>
          <p className="text-secondary text-sm">Unlock achievements and customize your profile.</p>
        </div>
        <div className="text-right bg-bg-card px-lg py-sm rounded-xl border border-border shadow-sm flex flex-col items-end">
          <span className="text-xs text-secondary uppercase font-bold tracking-wider mb-1">Completion</span>
          <div className="text-2xl font-black text-text-primary leading-none">
            {unlockedBadges.length} <span className="text-lg text-secondary font-medium">/ {BADGE_CATALOG.length}</span>
          </div>
        </div>
      </div>

      {/* Future Scalability: Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-md mb-xl">
        <div className="flex-1 max-w-md">
          <Input 
            iconLeft={Search}
            placeholder="Search badges..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            clearable={true}
            onClear={() => setSearchQuery('')}
          />
        </div>
        <div className="flex gap-sm overflow-x-auto pb-sm sm:pb-0 hide-scrollbar">
          {['all', 'sales', 'social', 'purchases', 'products', 'tenure'].map(type => (
            <button 
              key={type}
              className={`px-md py-xs rounded-lg text-sm font-medium whitespace-nowrap capitalize transition-colors ${filterType === type ? 'bg-text-primary text-bg' : 'bg-bg-card border border-border text-secondary hover:text-text-primary'}`}
              onClick={() => setFilterType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Badges Grid */}
      <div className="badges-grid">
        {filteredBadges.map(badge => {
          const isUnlocked = unlockedBadges.includes(badge.id);
          const isEquipped = (gamificationState.displayedBadges || []).includes(badge.id);
          
          return (
            <div key={badge.id} className={`badge-card ${isUnlocked ? 'unlocked' : 'locked'} group`}>
              <div className="flex-shrink-0">
                <BadgeIcon badge={badge} locked={!isUnlocked} size="lg" />
              </div>
              <div className="badge-card-content flex-1">
                <h3 className="badge-card-title">{badge.title}</h3>
                <p className="badge-card-desc">{isUnlocked ? badge.desc : `Locked — ${badge.desc}`}</p>
                <div className="flex items-center justify-between mt-sm">
                  {isUnlocked && <span className="badge-unlocked-label">Unlocked</span>}
                  {isUnlocked && (
                    <button
                      onClick={async () => {
                        try {
                          const currentDisplayed = gamificationState.displayedBadges || [];
                          let newDisplayed;
                          if (isEquipped) {
                            newDisplayed = currentDisplayed.filter(id => id !== badge.id);
                          } else {
                            if (currentDisplayed.length >= 3) {
                              alert('You can only equip up to 3 badges at a time.');
                              return;
                            }
                            newDisplayed = [...currentDisplayed, badge.id];
                          }
                          // Optimistic update (handled by realtime shortly anyway)
                          await supabase.from('profiles').update({ displayed_badges: newDisplayed }).eq('id', profile.id);
                        } catch(e) {
                          console.error(e);
                        }
                      }}
                      className={`px-sm py-xs rounded-md text-xs font-bold transition-colors ${
                        isEquipped 
                          ? 'bg-accent text-white' 
                          : 'bg-bg-secondary text-secondary hover:text-text-primary'
                      }`}
                    >
                      {isEquipped ? 'Equipped' : 'Equip'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredBadges.length === 0 && (
          <div className="col-span-full py-3xl text-center text-secondary">
            <p>No badges found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
