-- ==============================================================================
-- PHASE 4: Postgres Badge Evaluation
-- ==============================================================================

CREATE OR REPLACE FUNCTION evaluate_badges(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_profile RECORD;
  v_products_count INT;
  v_purchases_count INT;
  v_sales_count INT;
  v_new_badges TEXT[] := '{}';
BEGIN
  -- Get the current profile state
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 1. Sales Badges (Live COUNT from purchases table)
  IF NOT ('first_sale' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) OR NOT ('half_century' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    SELECT COUNT(*) INTO v_sales_count FROM purchases WHERE seller_id = p_user_id AND status = 'completed';
    
    IF v_sales_count >= 1 AND NOT ('first_sale' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
      v_new_badges := array_append(v_new_badges, 'first_sale');
    END IF;
    
    IF v_sales_count >= 50 AND NOT ('half_century' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
      v_new_badges := array_append(v_new_badges, 'half_century');
    END IF;
  END IF;

  -- 2. Purchase Badges
  IF NOT ('first_purchase' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    SELECT COUNT(*) INTO v_purchases_count FROM purchases WHERE buyer_id = p_user_id AND status = 'completed';
    IF v_purchases_count >= 1 THEN
      v_new_badges := array_append(v_new_badges, 'first_purchase');
    END IF;
  END IF;

  -- 3. Product Badges
  IF NOT ('prolific_creator' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    SELECT COUNT(*) INTO v_products_count FROM products WHERE seller_id = p_user_id AND status = 'published';
    IF v_products_count >= 10 THEN
      v_new_badges := array_append(v_new_badges, 'prolific_creator');
    END IF;
  END IF;

  -- 4. Tenure Badges
  IF (now() - v_profile.created_at) >= INTERVAL '7 days' AND NOT ('one_week' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    v_new_badges := array_append(v_new_badges, 'one_week');
  END IF;
  
  IF (now() - v_profile.created_at) >= INTERVAL '30 days' AND NOT ('one_month' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    v_new_badges := array_append(v_new_badges, 'one_month');
  END IF;

  IF (now() - v_profile.created_at) >= INTERVAL '180 days' AND NOT ('six_months' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    v_new_badges := array_append(v_new_badges, 'six_months');
  END IF;

  IF (now() - v_profile.created_at) >= INTERVAL '365 days' AND NOT ('one_year' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    v_new_badges := array_append(v_new_badges, 'one_year');
  END IF;

  -- 5. Streak Badges
  IF v_profile.streak >= 7 AND NOT ('one_week_streak' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    v_new_badges := array_append(v_new_badges, 'one_week_streak');
  END IF;

  -- 6. Level Badges
  IF v_profile.level >= 10 AND NOT ('level_10' = ANY(COALESCE(v_profile.unlocked_badges, '{}'))) THEN
    v_new_badges := array_append(v_new_badges, 'level_10');
  END IF;

  -- If we unlocked any new badges, append them to the profile array atomically
  IF array_length(v_new_badges, 1) > 0 THEN
    UPDATE profiles 
    SET unlocked_badges = array_cat(COALESCE(v_profile.unlocked_badges, '{}'), v_new_badges)
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Modify existing add_xp_and_level_up to call evaluate_badges at the end
CREATE OR REPLACE FUNCTION add_xp_and_level_up(p_user_id UUID, p_xp_amount INT)
RETURNS VOID AS $$
DECLARE
  v_current_xp INT;
  v_new_xp INT;
  v_new_level INT;
  v_next_level_xp INT;
BEGIN
  -- Get current XP
  SELECT xp INTO v_current_xp FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_xp := COALESCE(v_current_xp, 0) + p_xp_amount;

  -- Calculate Exponential Level 
  v_new_level := FLOOR(LOG(1.3, (v_new_xp / 500.0) + 1)) + 1;
  
  -- Calculate next level XP requirement
  v_next_level_xp := CEIL(500 * (POWER(1.3, v_new_level) - 1));

  -- Update the profile atomically
  UPDATE profiles
  SET xp = v_new_xp,
      level = v_new_level,
      next_level_xp = v_next_level_xp
  WHERE id = p_user_id;

  -- Trigger the badge evaluation now that XP and level are updated
  PERFORM evaluate_badges(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
