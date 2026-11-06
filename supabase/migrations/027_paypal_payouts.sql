-- 027_paypal_payouts.sql
-- Sellers can be paid to PayPal instead of Stripe.
--   profiles.payout_method  'stripe' (default) | 'paypal'
--   profiles.paypal_email   where PayPal payouts are sent (private: not in public_profiles)
--   paypal_payouts          one row per PayPal payout (written by the paypal-payout function only)
-- A purchase paid through PayPal gets stripe_transfer_id = 'pp_<payout id>'
-- (while in flight: 'pppending:<payout id>', never matched by the Stripe recovery).

alter table public.profiles add column if not exists payout_method text not null default 'stripe';
alter table public.profiles add column if not exists paypal_email text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_payout_method_valid') then
    alter table public.profiles add constraint profiles_payout_method_valid check (payout_method in ('stripe', 'paypal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_paypal_email_valid') then
    alter table public.profiles add constraint profiles_paypal_email_valid
      check (paypal_email is null or (length(paypal_email) <= 254 and paypal_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
  end if;
end $$;

create table if not exists public.paypal_payouts (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references public.profiles(id) on delete cascade,
  gross_cents     integer not null check (gross_cents > 0),
  fee_cents       integer not null default 0 check (fee_cents >= 0),
  net_cents       integer not null check (net_cents > 0),
  paypal_email    text not null,
  status          text not null default 'processing',  -- processing | pending | success | failed | returned
  paypal_batch_id text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists paypal_payouts_seller_idx on public.paypal_payouts (seller_id, created_at desc);

alter table public.paypal_payouts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'paypal_payouts' and policyname = 'paypal_payouts_own_select') then
    create policy paypal_payouts_own_select on public.paypal_payouts
      for select to authenticated using (seller_id = (select auth.uid()));
  end if;
end $$;
revoke insert, update, delete on public.paypal_payouts from anon, authenticated;
grant select on public.paypal_payouts to authenticated;
