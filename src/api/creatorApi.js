/**
 * Creator profile API — queries real Supabase public_profiles,
 * with MOCK_CREATORS fallback for offline/mock mode.
 */

import { supabase } from '../lib/supabase';
import { MOCK_CREATORS } from '../lib/seed';
import { getAllAccounts } from '../lib/accountStore';

/**
 * Calculates a creator's tier based on sales count.
 * ONLY used for MOCK_CREATORS fallback (real data has tier pre-computed server-side).
 * @param {number} salesCount 
 * @returns {string} tier (bronze, silver, gold, platinum)
 */
export function calculateUserTier(salesCount = 0) {
  if (salesCount >= 200) return 'platinum';
  if (salesCount >= 50) return 'gold';
  if (salesCount >= 10) return 'silver';
  return 'bronze';
}

/**
 * Fetches a creator profile by username.
 * Real mode: queries Supabase public_profiles (tier comes pre-computed).
 * Mock mode: falls back to local accountStore + MOCK_CREATORS seed data.
 */
export async function getCreatorProfile(username, isMockMode) {
  const usernameLower = username.toLowerCase();

  // ── Real Supabase path ──
  if (!isMockMode) {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('*')
      .ilike('username', usernameLower)
      .single();

    if (error || !data) {
      console.error('Creator not found in public_profiles:', error?.message || username);
      return null;
    }

    // Use tier directly from public_profiles (computed server-side in SQL)
    return {
      id: data.id,
      username: data.username,
      name: data.username,
      bio: data.bio,
      avatar_url: data.avatar_url,
      shop_settings: data.shop_settings || { bg_color: 'var(--color-bg)', card_radius: '16px', shadow_intensity: '0.05', links: [] },
      software: data.software || [],
      tier: data.tier || 'bronze',
      displayed_badges: data.displayed_badges || [],
      unlocked_badges: data.unlocked_badges || [],
      selected_frame: data.selected_frame || null,
    };
  }

  // ── Mock fallback path ──
  // 1. Try local accounts first
  const localAccounts = Object.values(getAllAccounts());
  let creator = localAccounts.find(a => (a.username || '').toLowerCase() === usernameLower);
  
  // 2. Fallback to mock seed data
  if (!creator) {
    creator = MOCK_CREATORS.find(c => (c.username || '').toLowerCase() === usernameLower);
  }

  if (!creator) {
    return null;
  }

  // 3. Compute tier from raw sales_count (only available in mock data)
  const tier = calculateUserTier(creator.sales_count);

  // 4. Map to safe public payload
  const safeProfile = {
    id: creator.id,
    username: creator.username,
    name: creator.name || creator.username,
    bio: creator.bio,
    avatar_url: creator.avatar_url || (creator.shop_settings ? creator.shop_settings.profile_image_url : null),
    shop_settings: creator.shop_settings || { bg_color: 'var(--color-bg)', card_radius: '16px', shadow_intensity: '0.05', links: [] },
    rating: creator.rating || 5.0,
    products_count: creator.products?.length || creator.products_count || 0,
    tier: tier,
    products: creator.products,
    software: creator.software || [],
    displayed_badges: creator.shop_settings?.displayed_badges || [],
  };

  return safeProfile;
}
