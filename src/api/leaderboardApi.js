/**
 * TEMPORARY MOCK — this module does NOT provide real data security.
 * Before connecting real seller data / going to production, this logic
 * MUST move to an actual server-side endpoint that never sends 
 * sales_count over the network.
 */

import { MOCK_CREATORS } from '../lib/seed';
import { getAllAccounts } from '../lib/accountStore';

import { supabase } from '../lib/supabase';

// Simple in-memory cache to simulate API caching (5 min TTL)
let cachedLeaderboard = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetches the Top 50 sellers, strictly sanitizing the payload to prevent sales_count leaks.
 * 
 * @param {boolean} forceRefresh - Bypass cache and recompute
 * @param {boolean} isMockMode - Whether to fetch from seed.js
 * @returns {Promise<Array>} Array of top 50 sellers (rank, id, username, name, avatar_url, level)
 */
export async function getTopSellers(forceRefresh = false, isMockMode = true) {
  const now = Date.now();
  
  if (!forceRefresh && cachedLeaderboard && (now - lastFetchTime < CACHE_TTL)) {
    return cachedLeaderboard;
  }

  if (!isMockMode) {
    const { data, error } = await supabase
      .from('public_leaderboard')
      .select('*')
      .order('rank', { ascending: true });
      
    if (error) {
      console.error("Error fetching public leaderboard:", error);
      return [];
    }
    
    // Map to expected UI payload
    const safePayload = data.map(row => ({
      rank: row.rank,
      id: row.seller_id,
      username: row.username,
      name: row.username, // public_leaderboard doesn't expose real name currently, fallback to username
      avatar_url: row.avatar_url,
      // Map tier to the legacy gamification level if needed by BestSellersPage
      level: row.tier === 'platinum' ? 50 : row.tier === 'gold' ? 40 : row.tier === 'silver' ? 20 : 10,
      tier: row.tier
    }));
    
    cachedLeaderboard = safePayload;
    lastFetchTime = now;
    return safePayload;
  }

  // MOCK MODE LOGIC
  // 1. Gather all data (simulate database query)
  const localAccounts = Object.values(getAllAccounts());
  const allSellers = [...MOCK_CREATORS];

  // Merge local accounts (prevent duplicates by username)
  for (const acc of localAccounts) {
    if (acc.products?.length > 0 || acc.sales_count > 0) {
      if (!allSellers.find(s => s.username === acc.username)) {
        allSellers.push(acc);
      }
    }
  }

  // 2. Sort by sales descending (Simulating ORDER BY sales_count DESC)
  allSellers.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));

  // 3. Slice top 50 (Simulating LIMIT 50)
  const top50 = allSellers.slice(0, 50);

  // 4. CRITICAL SECURITY GUARDRAIL: Map to safe payload
  // Strip ALL numeric sales/revenue data before returning
  const safePayload = top50.map((seller, index) => {
    return {
      rank: index + 1,
      id: seller.id,
      username: seller.username,
      name: seller.name || seller.username,
      avatar_url: seller.avatar_url || seller.avatar || null,
      level: Math.max(10, 50 - index), // Simple level derivation for gamification UI
    };
  });

  // Update cache
  cachedLeaderboard = safePayload;
  lastFetchTime = now;

  // Simulate network delay to emulate real fetch
  await new Promise(resolve => setTimeout(resolve, 400));

  return cachedLeaderboard;
}
