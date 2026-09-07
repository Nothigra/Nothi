-- ==============================================================================
-- Migration: 007_stripe_columns.sql
-- Description: Adds Stripe Connect account tracking to profiles, and links
--              purchases to their verified Stripe PaymentIntent for auditability.
-- ==============================================================================

-- Add stripe_account_id to profiles.
-- Populated after a seller completes Stripe Express onboarding.
-- NULL means the seller has not yet connected a Stripe account.
ALTER TABLE profiles
  ADD COLUMN stripe_account_id text;

-- Add stripe_payment_intent_id to purchases.
-- Populated by the stripe-webhook Edge Function on checkout.session.completed.
-- NULL for free purchases (which bypass Stripe entirely).
ALTER TABLE purchases
  ADD COLUMN stripe_payment_intent_id text;
