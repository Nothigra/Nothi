-- 024_launch_hardening.sql
-- Security + data-integrity pass before launch (audit of 2026-11-06).
--
--  1. Internal SECURITY DEFINER functions can no longer be called from the
--     browser (add_xp_and_level_up was callable by anyone, even signed out).
--  2. Gamification columns (xp, level, badges, frames, streak) are server-only;
--     the badges/frame a user SHOWS must be ones they really unlocked.
--  3. XP is awarded once per event (no publish/unpublish farming) and free
--     claims give a small XP amount to the buyer only.
--  4. Messages: the receiver can only mark them read; basic anti-spam.
--  5. Product views: deduplicated per signed-in viewer, capped per product.
--  6. Products with buyers are archived instead of deleted (buyers keep access);
--     buyers read their library through get_library_products().
--  7. Refunds / disputes: purchase status changes keep the counters right.
--  8. Fixed search_path on every function, missing indexes, RLS policies that
--     evaluate auth.uid() once per query.
-- Applied to the live project as 024a..024d (no DROP statements).
--  9. public_products: the popular ranking no longer sorts the whole table on
--     every read (popular_rank stays, as the negative score, so older clients
--     keep sorting correctly); effective_price for server-side price filters.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Function privileges
-- ─────────────────────────────────────────────────────────────────────────
revoke execute on function public.add_xp_and_level_up(uuid, integer) from public, anon, authenticated;
revoke execute on function public.evaluate_badges(uuid)               from public, anon, authenticated;
revoke execute on function public.increment_product_views(uuid)       from public, anon, authenticated;
revoke execute on function public.handle_new_user()                   from public, anon, authenticated;
revoke execute on function public.increment_sales_count()             from public, anon, authenticated;
revoke execute on function public.recompute_product_rating()          from public, anon, authenticated;
revoke execute on function public.trigger_product_xp()                from public, anon, authenticated;
revoke execute on function public.trigger_purchase_xp()               from public, anon, authenticated;
revoke execute on function public.update_unlocked_frames()            from public, anon, authenticated;
revoke execute on function public.protect_product_privileged_columns() from public, anon, authenticated;
revoke execute on function public.protect_profile_privileged_columns() from public, anon, authenticated;
-- used inside the free-claim RLS check, so signed-in users still need it
revoke execute on function public.is_free_claimable(uuid, uuid) from public, anon;
grant  execute on function public.is_free_claimable(uuid, uuid) to authenticated;

-- fixed search_path everywhere
alter function public.add_xp_and_level_up(uuid, integer)  set search_path = public;
alter function public.evaluate_badges(uuid)               set search_path = public;
alter function public.handle_new_user()                   set search_path = public;
alter function public.recompute_product_rating()          set search_path = public;
alter function public.trigger_product_xp()                set search_path = public;
alter function public.trigger_purchase_xp()               set search_path = public;
alter function public.update_unlocked_frames()            set search_path = public;
alter function public.protect_product_privileged_columns() set search_path = public;
alter function public.protect_profile_privileged_columns() set search_path = public;
alter function public.active_sale_price(numeric, numeric, timestamptz) set search_path = public;
alter function public.boost_pack_allowance(integer)       set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Profiles: server-only gamification columns + honest showcases
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_shown jsonb;
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
    -- gamification is earned on the server only
    new.xp                := old.xp;
    new.level             := old.level;
    new.next_level_xp     := old.next_level_xp;
    new.streak            := old.streak;
    new.last_claimed_date := old.last_claimed_date;
    new.unlocked_badges   := old.unlocked_badges;
    new.unlocked_frames   := old.unlocked_frames;
    new.email             := old.email;
    new.created_at        := old.created_at;
  end if;

  -- what is SHOWN must have been unlocked (max 5)
  new.displayed_badges := coalesce((
    select array_agg(b order by ord)
    from (select b, ord from unnest(coalesce(new.displayed_badges, '{}')) with ordinality as t(b, ord)
          where b = any(coalesce(new.unlocked_badges, '{}')) limit 5) s
  ), '{}');

  if new.shop_settings ? 'displayed_badges' then
    select coalesce(jsonb_agg(to_jsonb(b) order by ord), '[]'::jsonb) into v_shown
    from (select b, ord from jsonb_array_elements_text(
            case when jsonb_typeof(new.shop_settings->'displayed_badges') = 'array'
                 then new.shop_settings->'displayed_badges' else '[]'::jsonb end) with ordinality as t(b, ord)
          where b = any(coalesce(new.unlocked_badges, '{}')) limit 5) s;
    new.shop_settings := jsonb_set(new.shop_settings, '{displayed_badges}', v_shown);
  end if;

  if new.selected_frame is not null and new.selected_frame not in ('none', '')
     and not (new.selected_frame = any(coalesce(new.unlocked_frames, '{}'))) then
    new.selected_frame := old.selected_frame;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. XP once per event
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.xp_awards (
  reason     text        not null,
  ref_id     uuid        not null,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  amount     integer     not null,
  created_at timestamptz not null default now(),
  primary key (reason, ref_id, user_id)
);
alter table public.xp_awards enable row level security;
create index if not exists xp_awards_user_idx on public.xp_awards (user_id, created_at desc);

-- award p_amount once for (reason, ref, user); returns true when awarded
create or replace function public.award_xp_once(p_user uuid, p_reason text, p_ref uuid, p_amount integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_amount <= 0 then return false; end if;
  insert into xp_awards (reason, ref_id, user_id, amount) values (p_reason, p_ref, p_user, p_amount)
  on conflict do nothing;
  if not found then return false; end if;
  perform add_xp_and_level_up(p_user, p_amount);
  return true;
end;
$$;
revoke execute on function public.award_xp_once(uuid, text, uuid, integer) from public, anon, authenticated;

create or replace function public.trigger_product_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today integer;
begin
  if new.status = 'published' and new.seller_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    -- at most 5 rewarded publications per seller per day
    select count(*) into v_today from xp_awards
     where user_id = new.seller_id and reason = 'publish' and created_at > now() - interval '1 day';
    if v_today < 5 then
      perform award_xp_once(new.seller_id, 'publish', new.id, 150);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.trigger_purchase_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    if coalesce(new.is_free, false) or coalesce(new.price_paid, 0) = 0 then
      -- free claims: a little XP for the buyer, nothing for the seller (no farming with alt accounts)
      perform award_xp_once(new.buyer_id, 'claim', new.id, 20);
      perform evaluate_badges(new.buyer_id);
    else
      perform award_xp_once(new.buyer_id, 'buy', new.id, 100);
      perform award_xp_once(new.seller_id, 'sell', new.id, 300);
      if new.buyer_id is not null then perform evaluate_badges(new.buyer_id); end if;
      if new.seller_id is not null then perform evaluate_badges(new.seller_id); end if;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.trigger_product_xp()  from public, anon, authenticated;
revoke execute on function public.trigger_purchase_xp() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Messages
-- ─────────────────────────────────────────────────────────────────────────
revoke insert, update on public.messages from anon, authenticated;
grant insert (sender_id, receiver_id, product_id, content, attachment_url, attachment_type) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

create or replace function public.guard_message_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_recent integer;
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
    new.read_at    := null;
    if length(coalesce(new.content, '')) > 5000 then
      raise exception 'MESSAGE_TOO_LONG' using hint = 'Messages are limited to 5000 characters.';
    end if;
    if new.attachment_url is not null
       and new.attachment_url !~ '^(nothi-private:chat-attachments/|https://)' then
      raise exception 'INVALID_ATTACHMENT';
    end if;
    select count(*) into v_recent from messages
     where sender_id = new.sender_id and created_at > now() - interval '1 minute';
    if v_recent >= 30 then
      raise exception 'RATE_LIMITED' using hint = 'Too many messages, wait a minute.';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_message_insert() from public, anon, authenticated;
create or replace trigger trg_guard_message_insert before insert on public.messages
  for each row execute function public.guard_message_insert();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Product views
-- ─────────────────────────────────────────────────────────────────────────
alter table public.analytics_events add column if not exists viewer_id uuid;
create index if not exists idx_analytics_events_viewer
  on public.analytics_events (viewer_id, product_id, created_at desc) where viewer_id is not null;

create or replace function public.log_product_view(
  product_id_param uuid, source_param text default 'direct', device_type_param text default 'desktop')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
  v_status text;
  v_uid    uuid := auth.uid();
begin
  select seller_id, status into v_seller, v_status from products where id = product_id_param;
  if v_seller is null or v_status is distinct from 'published' then return; end if;
  if v_uid = v_seller then return; end if;                       -- own views don't count

  if v_uid is not null then
    -- one view per signed-in person and product every 30 minutes
    if exists (select 1 from analytics_events
               where viewer_id = v_uid and product_id = product_id_param
                 and created_at > now() - interval '30 minutes') then
      return;
    end if;
  else
    -- signed-out: at most 3 counted views per product every 10 seconds
    if (select count(*) from analytics_events
        where product_id = product_id_param and viewer_id is null
          and created_at > now() - interval '10 seconds') >= 3 then
      return;
    end if;
  end if;

  insert into analytics_events (product_id, seller_id, event_type, source, device_type, viewer_id)
  values (product_id_param, v_seller, 'view',
          case when source_param in ('direct', 'google', 'social', 'other') then source_param else 'other' end,
          case when device_type_param in ('mobile', 'desktop', 'tablet') then device_type_param else 'desktop' end,
          v_uid);

  update products set views = coalesce(views, 0) + 1 where id = product_id_param;
end;
$$;
grant execute on function public.log_product_view(uuid, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Archive instead of delete, buyer library
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_status_valid') then
    alter table public.products add constraint products_status_valid check (status in ('draft', 'published', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_price_valid') then
    alter table public.products add constraint products_price_valid check (price = 0 or price >= 0.5);
  end if;
end $$;

create or replace function public.archive_instead_of_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from purchases where product_id = old.id) then
    update products set status = 'archived', updated_at = now() where id = old.id;
    return null;  -- keep the row: buyers still own it
  end if;
  return old;
end;
$$;
revoke execute on function public.archive_instead_of_delete() from public, anon, authenticated;
create or replace trigger trg_archive_instead_of_delete before delete on public.products
  for each row execute function public.archive_instead_of_delete();

-- Library: everything the caller bought, whatever the product's status now.
create or replace function public.get_library_products(p_ids uuid[] default null)
returns table (id uuid, title text, price numeric, images text[], media jsonb, category text,
               status text, format text, file_size text, software text[], seller_id uuid, has_file boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.price, p.images, p.media, p.category, p.status, p.format, p.file_size,
         p.software, p.seller_id, (p.file_path is not null)
  from products p
  where exists (select 1 from purchases pu
                where pu.product_id = p.id and pu.buyer_id = auth.uid() and pu.status = 'completed')
    and (p_ids is null or p.id = any(p_ids));
$$;
revoke execute on function public.get_library_products(uuid[]) from public, anon;
grant execute on function public.get_library_products(uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Purchase status changes (refund / dispute) keep counters right
-- ─────────────────────────────────────────────────────────────────────────
alter table public.purchases add column if not exists refunded_at timestamptz;

create or replace function public.purchase_status_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sign integer;
begin
  if old.status = new.status then return new; end if;
  if old.status = 'completed' then v_sign := -1;
  elsif new.status = 'completed' then v_sign := 1;
  else return new;
  end if;
  update products set sales_count = greatest(coalesce(sales_count, 0) + v_sign, 0),
                      revenue     = greatest(coalesce(revenue, 0) + v_sign * coalesce(new.price_paid, 0), 0)
   where id = new.product_id;
  update profiles set sales_count = greatest(coalesce(sales_count, 0) + v_sign, 0),
                      revenue     = greatest(coalesce(revenue, 0) + v_sign * coalesce(new.price_paid, 0), 0)
   where id = new.seller_id;
  return new;
end;
$$;
revoke execute on function public.purchase_status_counts() from public, anon, authenticated;
create or replace trigger trg_purchase_status_counts after update of status on public.purchases
  for each row execute function public.purchase_status_counts();

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Indexes + RLS performance
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists products_seller_idx          on public.products (seller_id);
create index if not exists products_status_created_idx  on public.products (status, created_at desc);
create index if not exists products_software_gin        on public.products using gin (software);
create index if not exists products_style_gin           on public.products using gin (style);
create index if not exists purchases_seller_idx         on public.purchases (seller_id, purchased_at desc);
create index if not exists purchases_product_idx        on public.purchases (product_id);
create index if not exists purchases_pi_idx             on public.purchases (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists follows_creator_idx          on public.follows (creator_id);
create index if not exists messages_receiver_idx        on public.messages (receiver_id, created_at desc);
create index if not exists messages_sender_created_idx  on public.messages (sender_id, created_at desc);
create index if not exists reviews_buyer_idx            on public.reviews (buyer_id);
create index if not exists boost_usages_product_idx     on public.boost_usages (product_id);
create index if not exists reports_reporter_idx         on public.reports (reporter_id);
create index if not exists reports_product_idx          on public.reports (reported_product_id);
create index if not exists reports_user_idx             on public.reports (reported_user_id);

-- buyers can read their own checkout carts (nothing else is exposed)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='checkout_carts' and policyname='Buyers can view own carts') then
    create policy "Buyers can view own carts" on public.checkout_carts for select to authenticated using (buyer_id = (select auth.uid()));
  end if;
end $$;

-- every policy: evaluate auth.uid() once per query, not once per row
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql   text;
begin
  for r in select schemaname, tablename, policyname, qual, with_check
           from pg_policies where schemaname = 'public' loop
    v_using := case when r.qual is not null
      then regexp_replace(r.qual, '(?<!SELECT |select )auth\.uid\(\)', '(select auth.uid())', 'g') end;
    v_check := case when r.with_check is not null
      then regexp_replace(r.with_check, '(?<!SELECT |select )auth\.uid\(\)', '(select auth.uid())', 'g') end;
    if v_using is distinct from r.qual or v_check is distinct from r.with_check then
      v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      if v_using is not null then v_sql := v_sql || ' using (' || v_using || ')'; end if;
      if v_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
      execute v_sql;
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. public_products without a whole-table window function
-- ─────────────────────────────────────────────────────────────────────────
create or replace view public.public_products as
select p.id, p.title, p.description, p.price, p.category, p.video_url, p.images, p.media, p.status,
       p.seller_id, p.software, p.style, p.created_at, p.updated_at, p.reviews_count, p.rating,
       (p.boosted_until > timezone('utc', now())) as is_boosted,
       -- kept (same type) for older clients sorting ascending: the negative score sorts the same way
       (-(((p.sales_count + 10)::numeric * (1.0 + coalesce(p.rating, 0) / 5.0))
         * case when p.boosted_until > timezone('utc', now()) then 1.5 else 1.0 end) * 1000)::bigint as popular_rank,
       pr.username as creator_username,
       pr.avatar_url as creator_avatar,
       pr.bio as creator_bio,
       case when pr.sales_count >= 200 then 'platinum'
            when pr.sales_count >= 50  then 'gold'
            when pr.sales_count >= 10  then 'silver'
            else 'bronze' end as tier,
       (pr.plan = 'pro' and pr.show_pro_badge) as creator_is_pro,
       active_sale_price(p.price, p.sale_price, p.sale_ends_at) as sale_price,
       case when active_sale_price(p.price, p.sale_price, p.sale_ends_at) is not null
            then p.sale_ends_at end as sale_ends_at,
       p.file_size,
       p.format,
       (((p.sales_count + 10)::numeric * (1.0 + coalesce(p.rating, 0) / 5.0))
         * case when p.boosted_until > timezone('utc', now()) then 1.5 else 1.0 end) as popular_score,
       coalesce(active_sale_price(p.price, p.sale_price, p.sale_ends_at), p.price) as effective_price,
       p.sales_count
from products p
join profiles pr on p.seller_id = pr.id
where p.status = 'published';

grant select on public.public_products to anon, authenticated;

commit;
