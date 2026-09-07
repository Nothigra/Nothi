-- Migration: 016_backfill_stats.sql
-- Description: Backfills products and profiles revenue/sales_count from existing purchases.

BEGIN;

-- 1. Fix column types so they can hold exact decimal values (dollars and cents)
ALTER TABLE profiles ALTER COLUMN revenue TYPE numeric(10,2) USING revenue::numeric;

-- 2. Reset everything to 0 to prevent double counting
UPDATE products SET sales_count = 0, revenue = 0;
UPDATE profiles SET sales_count = 0, revenue = 0;

-- 3. Backfill products
WITH product_stats AS (
  SELECT 
    product_id,
    COUNT(*) as actual_sales,
    COALESCE(SUM(price_paid), 0) as actual_revenue
  FROM purchases
  WHERE status = 'completed'
  GROUP BY product_id
)
UPDATE products p
SET 
  sales_count = ps.actual_sales,
  revenue = ps.actual_revenue
FROM product_stats ps
WHERE p.id = ps.product_id;

-- 4. Backfill profiles
WITH profile_stats AS (
  SELECT 
    seller_id,
    COUNT(*) as actual_sales,
    COALESCE(SUM(price_paid), 0) as actual_revenue
  FROM purchases
  WHERE status = 'completed'
  GROUP BY seller_id
)
UPDATE profiles p
SET 
  sales_count = ps.actual_sales,
  revenue = ps.actual_revenue
FROM profile_stats ps
WHERE p.id = ps.seller_id;

COMMIT;
