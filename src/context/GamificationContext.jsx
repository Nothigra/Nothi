import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { isMockMode, invokeFunction, supabase, withTimeoutSafety } from '../lib/supabase';
import { fetchGamificationState, claimDailyReward as mockClaimDailyReward } from '../api/gamificationApi';

const GamificationContext = createContext(null);

export const GamificationProvider = ({ children }) => {
  const { profile, updateProfile } = useAuth();
  
  const [gamificationState, setGamificationState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnclaimedReward, setHasUnclaimedReward] = useState(false);

  // Helper to accurately check if the last claim was within the last 24 hours (UTC calendar day)
  const checkHasUnclaimedReward = (lastClaimedStr) => {
    if (!lastClaimedStr) return true;
    const now = new Date();
    const lastClaim = new Date(lastClaimedStr);
    
    const nowUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const lastUtcMidnight = Date.UTC(lastClaim.getUTCFullYear(), lastClaim.getUTCMonth(), lastClaim.getUTCDate());
    
    return (nowUtcMidnight - lastUtcMidnight) > 0;
  };

  const loadState = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isMockMode) {
        const state = await fetchGamificationState();
        setGamificationState(state);
        setHasUnclaimedReward(checkHasUnclaimedReward(state.lastClaimedDate));
      } else if (profile) {
        // Fetch fresh profile data directly from DB to avoid staleness from AuthContext
        const { data: freshProfile, error } = await supabase
          .from('profiles')
          .select('xp, level, next_level_xp, streak, last_claimed_date, unlocked_badges, displayed_badges, selected_frame, last_seen_badges_count, last_seen_xp')
          .eq('id', profile.id)
          .single();

        if (error) throw error;
        
        if (freshProfile) {
          const state = {
            xp: freshProfile.xp || 0,
            level: freshProfile.level || 1,
            nextLevelXP: freshProfile.next_level_xp || 200,
            streak: freshProfile.streak || 0,
            lastClaimedDate: freshProfile.last_claimed_date,
            unlockedBadges: freshProfile.unlocked_badges || [],
            displayedBadges: freshProfile.displayed_badges || [],
            selectedFrame: freshProfile.selected_frame || 'none',
            lastSeenBadgesCount: freshProfile.last_seen_badges_count || 0,
            lastSeenXp: freshProfile.last_seen_xp || 0
          };
          setGamificationState(state);
          setHasUnclaimedReward(checkHasUnclaimedReward(state.lastClaimedDate));
        }
      } else {
        setGamificationState(null);
        setHasUnclaimedReward(false);
      }
    } catch (e) {
      console.error("Failed to load gamification state:", e);
    } finally {
      setIsLoading(false);
    }
  }, [profile, isMockMode]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const markBadgesSeen = useCallback(async () => {
    if (!profile || !gamificationState || isMockMode) return;
    const currentCount = gamificationState.unlockedBadges.length;
    if (gamificationState.lastSeenBadgesCount >= currentCount) return;
    
    setGamificationState(prev => ({ ...prev, lastSeenBadgesCount: currentCount }));
    await supabase.from('profiles').update({ last_seen_badges_count: currentCount }).eq('id', profile.id);
  }, [profile, gamificationState, isMockMode]);

  const markXpSeen = useCallback(async () => {
    if (!profile || !gamificationState || isMockMode) return;
    const currentXp = gamificationState.xp;
    if (gamificationState.lastSeenXp >= currentXp) return;
    
    setGamificationState(prev => ({ ...prev, lastSeenXp: currentXp }));
    await supabase.from('profiles').update({ last_seen_xp: currentXp }).eq('id', profile.id);
  }, [profile, gamificationState, isMockMode]);

  // Realtime subscription to profiles table
  useEffect(() => {
    if (!profile || isMockMode) return;

    const channel = supabase.channel(`public:profiles:${profile.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles', 
        filter: `id=eq.${profile.id}` 
      }, (payload) => {
        const newProfile = payload.new;
        
        // Update reward claimable status instantly
        setHasUnclaimedReward(checkHasUnclaimedReward(newProfile.last_claimed_date));

        setGamificationState(prev => {
          if (!prev) return prev;
          
          // Only update if gamification fields actually changed
          if (newProfile.xp !== prev.xp || newProfile.level !== prev.level || newProfile.streak !== prev.streak || newProfile.last_claimed_date !== prev.lastClaimedDate || (newProfile.unlocked_badges || []).length !== prev.unlockedBadges.length || newProfile.last_seen_badges_count !== prev.lastSeenBadgesCount || newProfile.last_seen_xp !== prev.lastSeenXp) {
             return {
               ...prev,
               xp: newProfile.xp,
               level: newProfile.level,
               nextLevelXP: newProfile.next_level_xp,
               streak: newProfile.streak,
               lastClaimedDate: newProfile.last_claimed_date,
               unlockedBadges: newProfile.unlocked_badges || prev.unlockedBadges,
               displayedBadges: newProfile.displayed_badges || prev.displayedBadges,
               lastSeenBadgesCount: newProfile.last_seen_badges_count ?? prev.lastSeenBadgesCount,
               lastSeenXp: newProfile.last_seen_xp ?? prev.lastSeenXp
             };
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isMockMode]);

  const claimReward = async () => {
    if (!hasUnclaimedReward) return null;
    
    if (isMockMode) {
      const result = await mockClaimDailyReward();
      setGamificationState(result.newState);
      setHasUnclaimedReward(false);
      return result;
    }

    // Call the secure Edge Function
    try {
      const result = await invokeFunction('claim-daily-reward');
      
      // Update local context
      setGamificationState(result.newState);
      setHasUnclaimedReward(false);
      
      return result;
    } catch (error) {
      console.error("Failed to claim daily reward:", error);
      throw error;
    }
  };

  return (
    <GamificationContext.Provider value={{ 
      gamificationState, 
      isLoading, 
      hasUnclaimedReward, 
      claimReward, 
      refreshState: loadState,
      markBadgesSeen,
      markXpSeen
    }}>
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => useContext(GamificationContext);
