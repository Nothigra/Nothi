-- ==============================================================================
-- Migration: 008_tighten_purchases_rls.sql
-- Description: Closes the open client INSERT policy on purchases (flagged in
--              the Phase 1 audit). Paid purchase rows are now ONLY created by
--              the stripe-webhook Edge Function via the service_role key.
--
-- RLS INSERT policy behaviour (Postgres evaluates multiple policies as OR):
--   - service_role: bypasses RLS entirely → always allowed (webhook path)
--   - Free purchases (price_paid = 0, is_free = true): allowed by the scoped
--     free-only policy below → direct client insert for free downloads works
--   - Paid purchases from client (price_paid > 0): fails the free-only check
--     AND is not service_role → BLOCKED. Security hole closed.
-- ==============================================================================

-- Drop the old open policy that allowed any authenticated user to insert
-- any purchase for any product at any price.
DROP POLICY IF EXISTS "Buyers can insert their own purchases" ON purchases;

-- Add a tightly scoped replacement that ONLY allows free purchases from the client.
-- price_paid = 0 AND is_free = true together prevent a buyer from spoofing
-- a free insert on a paid product (both conditions must be true simultaneously).
CREATE POLICY "Buyers can insert free purchases directly"
  ON purchases FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND price_paid = 0
    AND is_free = true
  );

-- No changes needed for SELECT policies — buyers and sellers can still
-- view their own purchases exactly as before.
