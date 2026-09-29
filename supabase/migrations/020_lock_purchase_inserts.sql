-- Migration: 020_lock_purchase_inserts.sql
--
-- SECURITY: the free-claim policy (019) restricts WHICH product can be claimed,
-- but Supabase's default grants let the client write EVERY column of the row.
-- A seller could claim their own free product from a second account with
-- seller_amount_cents = 1000000 and then "Request Payout" — paid from the
-- platform's balance. Or plant someone else's stripe_payment_intent_id so the
-- webhook skips that buyer's real purchase.
-- (Checked before applying: every existing free row has these columns NULL.)
--
-- Two independent layers:
--   1. Column privileges: clients may only INSERT the 7 columns the free-claim
--      flow sends. Money / Stripe columns are writable by the service role only.
--   2. The policy also requires those columns to be NULL (defence in depth).
-- Plus: anon never needs to write purchases at all.

revoke insert, update, delete, truncate on purchases from anon;
revoke insert, update, delete, truncate on purchases from authenticated;

grant insert (buyer_id, seller_id, product_id, price_paid, currency, is_free, status)
  on purchases to authenticated;

drop policy if exists "Buyers can insert free purchases directly" on purchases;
create policy "Buyers can insert free purchases directly"
  on purchases for insert
  to authenticated
  with check (
    auth.uid() = buyer_id
    and price_paid = 0
    and is_free = true
    and status = 'completed'
    and buyer_id <> seller_id
    and public.is_free_claimable(product_id, seller_id)
    and seller_amount_cents is null
    and platform_fee_cents is null
    and stripe_fee_cents is null
    and stripe_payment_intent_id is null
    and stripe_transfer_id is null
    and transaction_id is null
  );
