-- ==============================================================================
-- PHASE 2: Gamification XP & Leveling Triggers
-- ==============================================================================

-- 1. Core Logic: Safely increment XP and recalculate Exponential Level
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
  -- L = floor(log(1.3, (Total XP / 500) + 1)) + 1
  v_new_level := FLOOR(LOG(1.3, (v_new_xp / 500.0) + 1)) + 1;
  
  -- Calculate next level XP requirement
  -- Next_XP = 500 * (1.3^L - 1)
  v_next_level_xp := CEIL(500 * (POWER(1.3, v_new_level) - 1));

  -- Update the profile atomically
  UPDATE profiles
  SET xp = v_new_xp,
      level = v_new_level,
      next_level_xp = v_next_level_xp
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Trigger Function: Award XP on Purchases
CREATE OR REPLACE FUNCTION trigger_purchase_xp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire on newly completed purchases
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'completed')) THEN
    -- Award buyer 100 XP
    IF NEW.buyer_id IS NOT NULL THEN
      PERFORM add_xp_and_level_up(NEW.buyer_id, 100);
    END IF;
    -- Award seller 300 XP
    IF NEW.seller_id IS NOT NULL THEN
      PERFORM add_xp_and_level_up(NEW.seller_id, 300);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_xp ON purchases;
CREATE TRIGGER on_purchase_xp
AFTER INSERT OR UPDATE ON purchases
FOR EACH ROW EXECUTE FUNCTION trigger_purchase_xp();


-- 3. Trigger Function: Award XP on Published Products
CREATE OR REPLACE FUNCTION trigger_product_xp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when a product is newly published
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'published')) THEN
    -- Award creator 150 XP
    IF NEW.seller_id IS NOT NULL THEN
      PERFORM add_xp_and_level_up(NEW.seller_id, 150);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_product_xp ON products;
CREATE TRIGGER on_product_xp
AFTER INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION trigger_product_xp();
