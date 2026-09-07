import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth: verify user from JWT ───────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // ── Fetch current gamification state with Service Role ───────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('streak, last_claimed_date, xp, level, next_level_xp, unlocked_badges, displayed_badges, selected_frame')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');

    const now = new Date();
    const lastClaimed = profile.last_claimed_date ? new Date(profile.last_claimed_date) : null;
    let newStreak = 1;

    if (lastClaimed) {
      // Use UTC calendar dates to determine if it's the "next day"
      const nowUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const lastUtcMidnight = Date.UTC(lastClaimed.getUTCFullYear(), lastClaimed.getUTCMonth(), lastClaimed.getUTCDate());
      
      const daysDiff = (nowUtcMidnight - lastUtcMidnight) / (1000 * 60 * 60 * 24);

      // Enforce 1 claim per calendar day
      if (daysDiff === 0) {
        throw new Error('You have already claimed your daily reward today. Come back tomorrow!');
      }

      // If claimed exactly 1 calendar day later, continue streak. Otherwise, reset to 1.
      if (daysDiff === 1) {
        newStreak = (profile.streak || 0) + 1;
      }
    }

    // ── Update streak and last_claimed_date ──────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        streak: newStreak,
        last_claimed_date: now.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) throw new Error('Failed to update streak');

    // ── Call add_xp_and_level_up to securely award XP ────────────────────────
    const rewardXP = 150;
    const { error: rpcError } = await supabaseAdmin.rpc('add_xp_and_level_up', {
      p_user_id: user.id,
      p_xp_amount: rewardXP,
    });

    if (rpcError) throw new Error('Failed to award XP');

    // ── Fetch final profile state to return ──────────────────────────────────
    const { data: finalProfile, error: finalProfileError } = await supabaseAdmin
      .from('profiles')
      .select('streak, last_claimed_date, xp, level, next_level_xp, unlocked_badges, displayed_badges, selected_frame')
      .eq('id', user.id)
      .single();

    if (finalProfileError || !finalProfile) throw new Error('Failed to fetch updated profile');

    return new Response(
      JSON.stringify({ 
        success: true, 
        rewardXP,
        todayRewardName: "150 XP Boost",
        newState: {
          xp: finalProfile.xp,
          level: finalProfile.level,
          nextLevelXP: finalProfile.next_level_xp,
          streak: finalProfile.streak,
          lastClaimedDate: finalProfile.last_claimed_date,
          unlockedBadges: finalProfile.unlocked_badges || [],
          displayedBadges: finalProfile.displayed_badges || [],
          selectedFrame: finalProfile.selected_frame || 'none'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('claim-daily-reward error:', error);
    // Determine if it's a 400 (client error/cooldown) or 500
    const isCooldownError = error.message.includes('already claimed');
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: isCooldownError ? 400 : 500 }
    );
  }
});
