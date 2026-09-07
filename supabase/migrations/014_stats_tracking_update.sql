-- Migration: 014_stats_tracking_update.sql
-- ==========================================
-- PHASE 2: View Tracking RPC
-- ==========================================
CREATE OR REPLACE FUNCTION increment_product_views(product_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: Prevent the seller from artificially inflating their own product's view counts
  IF auth.uid() = (SELECT seller_id FROM products WHERE id = product_id_param) THEN
    RETURN;
  END IF;

  -- Increment the views column safely
  UPDATE products
  SET views = coalesce(views, 0) + 1
  WHERE id = product_id_param;
END;
$$;

-- ==========================================
-- PHASE 3: Revenue & Sales Tracking Trigger
-- ==========================================
CREATE OR REPLACE FUNCTION increment_sales_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Increment product sales_count AND gross revenue
  UPDATE products
  SET 
    sales_count = coalesce(sales_count, 0) + 1,
    revenue = coalesce(revenue, 0) + NEW.price_paid
  WHERE id = NEW.product_id;

  -- Increment seller profile sales_count AND gross revenue
  UPDATE profiles
  SET 
    sales_count = coalesce(sales_count, 0) + 1,
    revenue = coalesce(revenue, 0) + NEW.price_paid
  WHERE id = NEW.seller_id;

  RETURN NEW;
END;
$$;
