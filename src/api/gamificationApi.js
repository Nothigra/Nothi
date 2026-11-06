// The badge catalogue (artwork, rarity, English texts) lives in lib/badgeArt.
export { BADGES as BADGE_CATALOG } from '../lib/badgeArt';

// Mock Backend State - Decoupled from UI
let userGamificationState = {
  xp: 1240,
  level: 4,
  nextLevelXP: 2000,
  streak: 4,
  lastClaimedDate: null, // null means not claimed today
  unlockedBadges: ['first_purchase', 'one_week', 'prolific_creator', 'great_communicator'], // Array of badge IDs
  displayedBadges: ['first_purchase', 'prolific_creator'], // Array of badge IDs (max 3) featured on public shop
  selectedFrame: 'none' // To explicitly store user customization vs unlocked capabilities
};

/**
 * Fetches the user's current gamification profile from the backend.
 */
export const fetchGamificationState = async () => {
  return { ...userGamificationState };
};

/**
 * Executes a daily claim mutation.
 */
export const claimDailyReward = async () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (userGamificationState.lastClaimedDate) {
        return reject(new Error("Already claimed today"));
      }
      
      const rewardXP = 150;
      userGamificationState.xp += rewardXP;
      userGamificationState.lastClaimedDate = new Date().toISOString();
      
      resolve({ 
        success: true, 
        rewardXP,
        todayRewardName: "150 XP Boost",
        newState: { ...userGamificationState }
      });
    }, 600);
  });
};

/**
 * Updates the array of badges the user has chosen to feature on their public shop.
 * @param {string[]} badgeIds - Array of badge IDs to display (max 3)
 */
export const updateDisplayedBadges = async (badgeIds) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!Array.isArray(badgeIds)) return reject(new Error("Invalid payload"));
      if (badgeIds.length > 3) return reject(new Error("Maximum 3 featured badges allowed"));
      
      // Ensure they only select unlocked badges
      const validBadges = badgeIds.filter(id => userGamificationState.unlockedBadges.includes(id));
      
      userGamificationState.displayedBadges = validBadges;
      
      resolve({
        success: true,
        newState: { ...userGamificationState }
      });
    }, 300);
  });
};
