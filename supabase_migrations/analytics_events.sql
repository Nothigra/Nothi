-- ============================================================
-- Real Analytics tracking system for Nothi
-- Run this entire file once against the Supabase project.
-- ============================================================

-- 1. Events table: one row per product page view, with enough detail
--    to build real charts (over time), traffic sources, and device split.
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'view',
  source text NOT NULL DEFAULT 'direct',       -- 'direct' | 'google' | 'social' | 'other'
  device_type text NOT NULL DEFAULT 'desktop', -- 'mobile' | 'desktop' | 'tablet'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookups for "give me this seller's events in the last N days"
-- and "give me this product's events".
CREATE INDEX IF NOT EXISTS idx_analytics_events_seller_created
  ON analytics_events (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_product_created
  ON analytics_events (product_id, created_at DESC);

-- 2. Row Level Security: any visitor (including anonymous) can trigger a
--    logged view via the RPC below, but only the seller who owns the
--    product can ever read their own event rows back out.
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can read their own analytics events" ON analytics_events;
CREATE POLICY "Sellers can read their own analytics events"
  ON analytics_events
  FOR SELECT
  USING (auth.uid() = seller_id);

-- No direct INSERT policy for regular users: all writes go through the
-- SECURITY DEFINER function below, which resolves seller_id itself so it
-- can never be spoofed by a client passing an arbitrary seller_id.

-- 3. The actual tracking call. Replaces the old increment_product_views
--    RPC — this does the same counter increment AND logs a detailed event.
CREATE OR REPLACE FUNCTION log_product_view(
  product_id_param uuid,
  source_param text DEFAULT 'direct',
  device_type_param text DEFAULT 'desktop'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  SELECT seller_id INTO v_seller_id FROM products WHERE id = product_id_param;

  IF v_seller_id IS NOT NULL THEN
    INSERT INTO analytics_events (product_id, seller_id, event_type, source, device_type)
    VALUES (product_id_param, v_seller_id, 'view', source_param, device_type_param);
  END IF;

  -- Keep the existing simple counter on products.views in sync, since
  -- other parts of the app (e.g. the Overview page's stat cards) already
  -- read it directly.
  UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = product_id_param;
END;
$$;

-- Let any client (including anonymous visitors) call this function —
-- it's the only writer for analytics_events, so this is safe.
GRANT EXECUTE ON FUNCTION log_product_view(uuid, text, text) TO anon, authenticated;

-- 4. Convenience view: per-seller daily rollup, so the dashboard can chart
--    "views over time" and "sales over time" without scanning raw events
--    client-side. (Sales/revenue still come from the real purchases table
--    — this view is for the views/traffic side specifically.)
CREATE OR REPLACE VIEW seller_daily_views AS
SELECT
  seller_id,
  date_trunc('day', created_at) AS day,
  count(*) AS views,
  count(*) FILTER (WHERE source = 'direct') AS direct_views,
  count(*) FILTER (WHERE source = 'google') AS google_views,
  count(*) FILTER (WHERE source = 'social') AS social_views,
  count(*) FILTER (WHERE source = 'other') AS other_views,
  count(*) FILTER (WHERE device_type = 'mobile') AS mobile_views,
  count(*) FILTER (WHERE device_type = 'desktop') AS desktop_views,
  count(*) FILTER (WHERE device_type = 'tablet') AS tablet_views
FROM analytics_events
WHERE event_type = 'view'
GROUP BY seller_id, date_trunc('day', created_at);

-- The view inherits querying-user context, but to be safe under RLS,
-- restrict it the same way as the base table.
ALTER VIEW seller_daily_views SET (security_invoker = true);
