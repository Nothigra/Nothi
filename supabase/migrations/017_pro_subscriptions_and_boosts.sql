-- 017_pro_subscriptions_and_boosts.sql
--
-- Pro subscription (12 EUR/month or 99 EUR/year), paid + subscription boosts,
-- server-side plan limits, and the Pro badge.
--
-- Security model (the important part):
--   * Clients (roles `authenticated` / `anon`) can NEVER write plan,
--     subscription, money or sales-stat columns — a BEFORE trigger silently
--     restores the old values. Previously the "Users can update own profile"
--     RLS policy had no column restriction, so anyone could set their own
--     plan/balance/sales_count from the browser console, and sellers could
--     set products.boosted_until themselves (= free boosts).
--   * Legitimate writers are unaffected: Edge Functions use the service role,
--     and existing DB triggers (increment_sales_count, xp, ratings...) are
--     SECURITY DEFINER (run as postgres).
--   * Plan limits (30 products on Free) are enforced by a trigger, not just UI.
--   * Boost activation from the Pro quota goes through a SECURITY DEFINER RPC
--     that validates ownership, plan, pack lock and remaining quota atomically.

-- ─── 1. Subscription columns on profiles ─────────────────────────────────────
alter table public.profiles
  add column if not exists stripe_customer_id               text,
  add column if not exists subscription_id                  text,
  add column if not exists subscription_status              text,
  add column if not exists subscription_interval            text,
  add column if not exists subscription_current_period_end  timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false,
  add column if not exists show_pro_badge                   boolean not null default true;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

-- Before this migration nothing legitimately set `plan`: any non-free value
-- could only have been self-assigned from the browser. Pro now only comes
-- from a Stripe subscription, so reset anything without one.
update public.profiles set plan = 'free'
where plan is distinct from 'free' and subscription_id is null;

-- ─── 2. Boost usage ledger ───────────────────────────────────────────────────
create table if not exists public.boost_usages (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid not null references public.profiles(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  duration_days     integer not null check (duration_days in (1, 3, 7)),
  source            text not null check (source in ('subscription', 'paid')),
  period_month      date not null,                -- first day of the UTC month
  stripe_session_id text unique,                  -- idempotency for paid boosts
  amount_cents      integer,
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz not null,
  created_at        timestamptz not null default now()
);

create index if not exists boost_usages_seller_month_idx
  on public.boost_usages (seller_id, period_month);

alter table public.boost_usages enable row level security;

drop policy if exists "Sellers can view own boost usages" on public.boost_usages;
create policy "Sellers can view own boost usages"
  on public.boost_usages for select
  using (auth.uid() = seller_id);
-- No insert/update/delete policies: only SECURITY DEFINER functions and the
-- service role (webhook) can write here.

-- ─── 3. Protect privileged profile columns from client writes ────────────────
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.plan                              := old.plan;
    new.stripe_customer_id                := old.stripe_customer_id;
    new.subscription_id                   := old.subscription_id;
    new.subscription_status               := old.subscription_status;
    new.subscription_interval             := old.subscription_interval;
    new.subscription_current_period_end   := old.subscription_current_period_end;
    new.subscription_cancel_at_period_end := old.subscription_cancel_at_period_end;
    new.stripe_account_id                 := old.stripe_account_id;
    new.balance                           := old.balance;
    new.revenue                           := old.revenue;
    new.sales_count                       := old.sales_count;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ─── 4. Protect privileged product columns + enforce Free plan limit ─────────
create or replace function public.protect_product_privileged_columns()
returns trigger
language plpgsql
as $$
declare
  v_plan  text;
  v_count integer;
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.boosted_until := null;
      new.sales_count   := 0;
      new.revenue       := 0;
      new.views         := 0;
      new.rating        := 0;
      new.reviews_count := 0;
      new.is_featured   := false;

      -- Free plan: max 30 products. Pro: unlimited.
      -- Serialise inserts per seller so parallel requests can't all pass the count.
      perform pg_advisory_xact_lock(hashtext('products:' || new.seller_id::text));
      select coalesce(plan, 'free') into v_plan from public.profiles where id = new.seller_id;
      if v_plan is distinct from 'pro' then
        select count(*) into v_count from public.products where seller_id = new.seller_id;
        if v_count >= 30 then
          raise exception 'PRODUCT_LIMIT_REACHED'
            using hint = 'Free plan allows 30 products. Upgrade to Pro for unlimited products.';
        end if;
      end if;
    else
      new.boosted_until := old.boosted_until;
      new.sales_count   := old.sales_count;
      new.revenue       := old.revenue;
      new.views         := old.views;
      new.rating        := old.rating;
      new.reviews_count := old.reviews_count;
      new.is_featured   := old.is_featured;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_product_privileged_columns on public.products;
create trigger trg_protect_product_privileged_columns
  before insert or update on public.products
  for each row execute function public.protect_product_privileged_columns();

-- ─── 5. Boost quota (Pro): one pack per UTC month ────────────────────────────
-- Packs: 3 x 24h  OR  2 x 3 days  OR  1 x 7 days. The first subscription boost
-- used in a month locks the pack for the rest of that month.
create or replace function public.boost_pack_allowance(p_days integer)
returns integer
language sql
immutable
as $$
  select case p_days when 1 then 3 when 3 then 2 when 7 then 1 else 0 end;
$$;

create or replace function public.get_my_boost_quota()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_month     date := date_trunc('month', timezone('utc', now()))::date;
  v_plan      text;
  v_pack_days integer;
  v_used      integer := 0;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select coalesce(plan, 'free') into v_plan from profiles where id = v_uid;

  select duration_days, count(*) into v_pack_days, v_used
  from boost_usages
  where seller_id = v_uid and source = 'subscription' and period_month = v_month
  group by duration_days
  limit 1;

  return json_build_object(
    'is_pro',       v_plan = 'pro',
    'period_month', v_month,
    'resets_at',    (v_month + interval '1 month'),
    'pack_days',    v_pack_days,                     -- null = no pack chosen yet
    'used',         coalesce(v_used, 0),
    'allowance',    case when v_pack_days is null then null else boost_pack_allowance(v_pack_days) end,
    'remaining',    case when v_pack_days is null then null
                         else greatest(boost_pack_allowance(v_pack_days) - coalesce(v_used, 0), 0) end
  );
end;
$$;

create or replace function public.activate_subscription_boost(p_product_id uuid, p_days integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_month     date := date_trunc('month', timezone('utc', now()))::date;
  v_plan      text;
  v_seller    uuid;
  v_status    text;
  v_current   timestamptz;
  v_pack_days integer;
  v_used      integer := 0;
  v_ends_at   timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_days not in (1, 3, 7) then
    raise exception 'INVALID_DURATION';
  end if;

  -- Serialise concurrent activations for the same seller (no double-spend).
  perform pg_advisory_xact_lock(hashtext('boost:' || v_uid::text));

  select coalesce(plan, 'free') into v_plan from profiles where id = v_uid;
  if v_plan is distinct from 'pro' then
    raise exception 'NOT_PRO';
  end if;

  select seller_id, status, boosted_until into v_seller, v_status, v_current
  from products where id = p_product_id
  for update;
  if v_seller is null or v_seller <> v_uid then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if v_status is distinct from 'published' then
    raise exception 'PRODUCT_NOT_PUBLISHED';
  end if;

  select duration_days, count(*) into v_pack_days, v_used
  from boost_usages
  where seller_id = v_uid and source = 'subscription' and period_month = v_month
  group by duration_days
  limit 1;

  if v_pack_days is not null and v_pack_days <> p_days then
    raise exception 'PACK_LOCKED:%', v_pack_days;
  end if;
  if coalesce(v_used, 0) >= boost_pack_allowance(p_days) then
    raise exception 'QUOTA_EXHAUSTED';
  end if;

  -- Stack on top of an active boost instead of overwriting it.
  v_ends_at := greatest(timezone('utc', now()), coalesce(v_current, timezone('utc', now())))
               + make_interval(days => p_days);

  insert into boost_usages (seller_id, product_id, duration_days, source, period_month, ends_at)
  values (v_uid, p_product_id, p_days, 'subscription', v_month, v_ends_at);

  update products set boosted_until = v_ends_at where id = p_product_id;

  return json_build_object(
    'boosted_until', v_ends_at,
    'pack_days',     p_days,
    'remaining',     boost_pack_allowance(p_days) - coalesce(v_used, 0) - 1
  );
end;
$$;

-- Called only by the Stripe webhook (service role) after a verified payment.
create or replace function public.grant_paid_boost(
  p_seller_id uuid, p_product_id uuid, p_days integer,
  p_session_id text, p_amount_cents integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current timestamptz;
  v_seller  uuid;
  v_ends_at timestamptz;
begin
  if p_days not in (1, 3, 7) then
    raise exception 'INVALID_DURATION';
  end if;

  -- Idempotency: Stripe may retry the webhook.
  if exists (select 1 from boost_usages where stripe_session_id = p_session_id) then
    return json_build_object('skipped', true);
  end if;

  select seller_id, boosted_until into v_seller, v_current
  from products where id = p_product_id
  for update;
  if v_seller is null or v_seller <> p_seller_id then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  v_ends_at := greatest(timezone('utc', now()), coalesce(v_current, timezone('utc', now())))
               + make_interval(days => p_days);

  insert into boost_usages (seller_id, product_id, duration_days, source, period_month,
                            stripe_session_id, amount_cents, ends_at)
  values (p_seller_id, p_product_id, p_days, 'paid',
          date_trunc('month', timezone('utc', now()))::date,
          p_session_id, p_amount_cents, v_ends_at);

  update products set boosted_until = v_ends_at where id = p_product_id;

  return json_build_object('boosted_until', v_ends_at);
end;
$$;

revoke all on function public.grant_paid_boost(uuid, uuid, integer, text, integer) from public, anon, authenticated;
grant execute on function public.grant_paid_boost(uuid, uuid, integer, text, integer) to service_role;

revoke all on function public.activate_subscription_boost(uuid, integer) from public, anon;
grant execute on function public.activate_subscription_boost(uuid, integer) to authenticated;
revoke all on function public.get_my_boost_quota() from public, anon;
grant execute on function public.get_my_boost_quota() to authenticated;

-- ─── 6. Advanced analytics (Pro only, checked server-side) ───────────────────
create or replace function public.get_advanced_analytics(p_days integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_plan      text;
  v_days      integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_now       timestamptz := now();
  v_start     timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
  v_prev      timestamptz := now() - make_interval(days => 2 * least(greatest(coalesce(p_days, 30), 1), 365));
  v_result    json;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select coalesce(plan, 'free') into v_plan from profiles where id = v_uid;
  if v_plan is distinct from 'pro' then
    raise exception 'NOT_PRO';
  end if;

  select json_build_object(
    'range_days', v_days,

    -- Current vs previous period totals (for % change)
    'current', json_build_object(
      'views',   (select count(*) from analytics_events
                  where seller_id = v_uid and event_type = 'view'
                    and created_at >= v_start and created_at < v_now),
      'sales',   (select count(*) from purchases
                  where seller_id = v_uid and status = 'completed'
                    and purchased_at >= v_start and purchased_at < v_now),
      'revenue', (select coalesce(sum(price_paid), 0) from purchases
                  where seller_id = v_uid and status = 'completed'
                    and purchased_at >= v_start and purchased_at < v_now)
    ),
    'previous', json_build_object(
      'views',   (select count(*) from analytics_events
                  where seller_id = v_uid and event_type = 'view'
                    and created_at >= v_prev and created_at < v_start),
      'sales',   (select count(*) from purchases
                  where seller_id = v_uid and status = 'completed'
                    and purchased_at >= v_prev and purchased_at < v_start),
      'revenue', (select coalesce(sum(price_paid), 0) from purchases
                  where seller_id = v_uid and status = 'completed'
                    and purchased_at >= v_prev and purchased_at < v_start)
    ),

    -- Per-product funnel: views -> sales -> revenue, conversion rate
    'products', coalesce((
      select json_agg(row_to_json(t) order by t.revenue desc, t.views desc)
      from (
        select p.id,
               p.title,
               p.price,
               (p.boosted_until > now()) as is_boosted,
               coalesce(v.views, 0)   as views,
               coalesce(s.sales, 0)   as sales,
               coalesce(s.revenue, 0) as revenue,
               case when coalesce(v.views, 0) > 0
                    then round(coalesce(s.sales, 0)::numeric * 100 / v.views, 2)
                    else 0 end        as conversion_rate
        from products p
        left join (
          select product_id, count(*) as views
          from analytics_events
          where seller_id = v_uid and event_type = 'view'
            and created_at >= v_start and created_at < v_now
          group by product_id
        ) v on v.product_id = p.id
        left join (
          select product_id, count(*) as sales, sum(price_paid) as revenue
          from purchases
          where seller_id = v_uid and status = 'completed'
            and purchased_at >= v_start and purchased_at < v_now
          group by product_id
        ) s on s.product_id = p.id
        where p.seller_id = v_uid
      ) t
    ), '[]'::json),

    -- When do people look at your products? (UTC weekday 0=Sun..6, hour 0..23)
    'heatmap', coalesce((
      select json_agg(json_build_object('dow', dow, 'hour', hr, 'views', c))
      from (
        select extract(dow from created_at)::int as dow,
               extract(hour from created_at)::int as hr,
               count(*) as c
        from analytics_events
        where seller_id = v_uid and event_type = 'view'
          and created_at >= v_start and created_at < v_now
        group by 1, 2
      ) h
    ), '[]'::json),

    -- Boost impact: views per day while boosted vs not boosted
    'boosts', coalesce((
      select json_agg(json_build_object(
        'product_id', b.product_id, 'duration_days', b.duration_days,
        'source', b.source, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'views_during', (select count(*) from analytics_events e
                         where e.product_id = b.product_id and e.event_type = 'view'
                           and e.created_at >= b.starts_at and e.created_at < least(b.ends_at, v_now))
      ) order by b.starts_at desc)
      from boost_usages b
      where b.seller_id = v_uid and b.starts_at >= v_start
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_advanced_analytics(integer) from public, anon;
grant execute on function public.get_advanced_analytics(integer) to authenticated;

-- ─── 7. Expose the Pro badge publicly (columns appended at the end) ──────────
create or replace view public.public_profiles as
 select id,
    username,
    avatar_url,
    bio,
    software,
    style,
    shop_settings,
    unlocked_badges,
    displayed_badges,
    selected_frame,
        case
            when sales_count >= 200 then 'platinum'::text
            when sales_count >= 50 then 'gold'::text
            when sales_count >= 10 then 'silver'::text
            else 'bronze'::text
        end as tier,
    (plan = 'pro' and show_pro_badge) as is_pro
   from profiles;

create or replace view public.public_products as
 select p.id,
    p.title,
    p.description,
    p.price,
    p.category,
    p.video_url,
    p.images,
    p.media,
    p.status,
    p.seller_id,
    p.software,
    p.style,
    p.created_at,
    p.updated_at,
    p.reviews_count,
    p.rating,
    p.boosted_until > timezone('utc'::text, now()) as is_boosted,
    row_number() over (order by ((p.sales_count + 10)::numeric * (1.0 + coalesce(p.rating, 0::numeric) / 5.0) *
        case
            when p.boosted_until > timezone('utc'::text, now()) then 1.5
            else 1.0
        end) desc, p.created_at desc) as popular_rank,
    pr.username as creator_username,
    pr.avatar_url as creator_avatar,
    pr.bio as creator_bio,
        case
            when pr.sales_count >= 200 then 'platinum'::text
            when pr.sales_count >= 50 then 'gold'::text
            when pr.sales_count >= 10 then 'silver'::text
            else 'bronze'::text
        end as tier,
    (pr.plan = 'pro' and pr.show_pro_badge) as creator_is_pro
   from products p
     join profiles pr on p.seller_id = pr.id
  where p.status = 'published'::text;
