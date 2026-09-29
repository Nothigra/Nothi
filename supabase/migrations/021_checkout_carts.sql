-- Migration: 021_checkout_carts.sql
--
-- Multi-product checkout. create-checkout-session snapshots the paid items of
-- a cart here (server-side prices, sellers) BEFORE creating the Stripe
-- Checkout Session, and puts only this row's id in the session metadata
-- (Stripe metadata values are capped at 500 chars — too small for a cart).
-- stripe-webhook reads it back to create one purchase row per product.
--
-- Service role only: no client policies, no client grants.

create table if not exists checkout_carts (
  id                uuid primary key default gen_random_uuid(),
  buyer_id          uuid not null references profiles(id) on delete cascade,
  -- [{ "product_id": uuid, "seller_id": uuid, "price_cents": int }]
  items             jsonb not null,
  total_cents       integer not null check (total_cents > 0),
  stripe_session_id text unique,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists checkout_carts_buyer_idx on checkout_carts (buyer_id, created_at desc);

alter table checkout_carts enable row level security;
revoke all on checkout_carts from anon, authenticated;
