import { Package, Star, MessageSquare, ShoppingBag, Upload, Calendar, Award, Crown, Zap, Flame } from 'lucide-react';

// Replace this with your actual R2 public URL base once you run the upload script
const BADGE_ASSET_BASE = 'https://pub-8c47adcb13034929b27e73e20b1327cc.r2.dev/badges';

// Centralized extensible catalog of all 20 badges
export const BADGE_CATALOG = [
  // Sales
  { id: 'first_sale', title: 'First Sale', desc: 'Make your first sale', type: 'sales', shape: 'hexagon', colorVariant: 'gold', imageUrl: `${BADGE_ASSET_BASE}/first_sale.png` },
  { id: 'half_century', title: 'Half Century', desc: 'Reach 50 total sales', type: 'sales', shape: 'shield', colorVariant: 'blue', imageUrl: `${BADGE_ASSET_BASE}/half_century.png` },
  { id: 'century_seller', title: 'Century Club', desc: 'Reach 100 total sales', type: 'sales', shape: 'diamond', colorVariant: 'platinum', imageUrl: `${BADGE_ASSET_BASE}/century_seller.png` },

  // Purchases
  { id: 'first_purchase', title: 'First Steps', desc: 'Buy your first product', type: 'purchases', shape: 'circle', colorVariant: 'purple', imageUrl: `${BADGE_ASSET_BASE}/first_purchase.png` },
  { id: 'collector', title: 'Collector', desc: 'Buy from 10 different creators', type: 'purchases', shape: 'hexagon', colorVariant: 'green', imageUrl: `${BADGE_ASSET_BASE}/collector.png` },

  // Creation
  { id: 'prolific_creator', title: 'Prolific Creator', desc: 'Publish 10 products', type: 'products', shape: 'hexagon', colorVariant: 'orange', imageUrl: `${BADGE_ASSET_BASE}/prolific_creator.png` },
  { id: 'master_creator', title: 'Master Creator', desc: 'Publish 50 products', type: 'products', shape: 'shield', colorVariant: 'platinum', imageUrl: `${BADGE_ASSET_BASE}/master_creator.png` },

  // Tenure
  { id: 'one_week', title: 'Getting Started', desc: 'Registered for 7 days', type: 'tenure', shape: 'circle', colorVariant: 'gray', imageUrl: `${BADGE_ASSET_BASE}/one_week.png` },
  { id: 'one_month', title: 'Regular', desc: 'Registered for 30 days', type: 'tenure', shape: 'shield', colorVariant: 'blue', imageUrl: `${BADGE_ASSET_BASE}/one_month.png` },
  { id: 'six_months', title: 'Veteran', desc: 'Registered for 6 months', type: 'tenure', shape: 'ribbon', colorVariant: 'gold', imageUrl: `${BADGE_ASSET_BASE}/six_months.png` },
  { id: 'one_year', title: 'Founding Member', desc: 'Registered for 1 year', type: 'tenure', shape: 'diamond', colorVariant: 'platinum', imageUrl: `${BADGE_ASSET_BASE}/one_year.png` },

  // Streak
  { id: 'week_streak', title: 'On Fire', desc: '7 day login streak', type: 'streak', shape: 'flame', colorVariant: 'orange', imageUrl: `${BADGE_ASSET_BASE}/week_streak.png` },
  { id: 'month_streak', title: 'Unstoppable', desc: '30 day login streak', type: 'streak', shape: 'flame', colorVariant: 'purple', imageUrl: `${BADGE_ASSET_BASE}/month_streak.png` },

  // Level (XP)
  { id: 'level_10', title: 'Rising Star', desc: 'Reach Level 10', type: 'level', shape: 'shield', colorVariant: 'blue', imageUrl: `${BADGE_ASSET_BASE}/level_10.png` },
  { id: 'level_20', title: 'Elite', desc: 'Reach Level 20', type: 'level', shape: 'hexagon', colorVariant: 'purple', imageUrl: `${BADGE_ASSET_BASE}/level_20.png` },
  { id: 'level_30', title: 'Legend', desc: 'Reach Level 30', type: 'level', shape: 'diamond', colorVariant: 'gold', imageUrl: `${BADGE_ASSET_BASE}/level_30.png` },

  // Leaderboard
  { id: 'top_50', title: 'Top 50', desc: 'Reach Top 50 Sellers', type: 'leaderboard', shape: 'ribbon', colorVariant: 'blue', imageUrl: `${BADGE_ASSET_BASE}/top_50.png` },
  { id: 'top_10', title: 'Top 10', desc: 'Reach Top 10 Sellers', type: 'leaderboard', shape: 'ribbon', colorVariant: 'gold', imageUrl: `${BADGE_ASSET_BASE}/top_10.png` },
  { id: 'number_one', title: 'The Legend', desc: 'Reach #1 Seller Rank', type: 'leaderboard', shape: 'crown', colorVariant: 'platinum', imageUrl: `${BADGE_ASSET_BASE}/number_one.png` },

  // Special
  { id: 'boosted', title: 'Spotlight', desc: 'Use product boost feature', type: 'special', shape: 'circle', colorVariant: 'blue', imageUrl: `${BADGE_ASSET_BASE}/boosted.png` },
];

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
