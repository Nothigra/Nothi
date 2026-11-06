-- 025_grades_and_badges.sql
-- New grade ladder (ring around the profile picture) and reachable level badges.
--   Grades by XP level: rookie 1, bronze 4, silver 8, gold 13, platinum 18, diamond 24.
--   Level badges: level_10 at 10, level_20 at 18, level_30 at 24 (level 30 needed
--   about 1 million XP before, which nobody could reach).
-- public_profiles exposes level and xp so shops can show the ring.

create or replace function public.update_unlocked_frames()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  g record;
begin
  for g in select * from (values ('bronze', 4), ('silver', 8), ('gold', 13), ('platinum', 18), ('diamond', 24)) as t(name, lvl) loop
    if coalesce(new.level, 1) >= g.lvl and not (g.name = any(coalesce(new.unlocked_frames, '{}'))) then
      new.unlocked_frames := array_append(coalesce(new.unlocked_frames, '{}'), g.name);
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.update_unlocked_frames() from public, anon, authenticated;

create or replace function public.evaluate_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p        profiles%rowtype;
  v_have     text[];
  v_new      text[] := '{}';
  v_sales    integer;
  v_buys     integer;
  v_sellers  integer;
  v_products integer;
  v_rank     integer;
  v_age      interval;
begin
  select * into v_p from profiles where id = p_user_id;
  if not found then return; end if;
  v_have := coalesce(v_p.unlocked_badges, '{}');
  v_age  := now() - v_p.created_at;

  select count(*) into v_sales from purchases where seller_id = p_user_id and status = 'completed' and not coalesce(is_free, false);
  select count(*), count(distinct seller_id) into v_buys, v_sellers from purchases where buyer_id = p_user_id and status = 'completed';
  select count(*) into v_products from products where seller_id = p_user_id and status = 'published';
  select rank into v_rank from public_leaderboard where seller_id = p_user_id;

  if v_sales >= 1   then v_new := v_new || 'first_sale'::text; end if;
  if v_sales >= 50  then v_new := v_new || 'half_century'::text; end if;
  if v_sales >= 100 then v_new := v_new || 'century_seller'::text; end if;
  if v_buys >= 1     then v_new := v_new || 'first_purchase'::text; end if;
  if v_sellers >= 10 then v_new := v_new || 'collector'::text; end if;
  if v_products >= 10 then v_new := v_new || 'prolific_creator'::text; end if;
  if v_products >= 50 then v_new := v_new || 'master_creator'::text; end if;
  if v_age >= interval '7 days'   then v_new := v_new || 'one_week'::text; end if;
  if v_age >= interval '30 days'  then v_new := v_new || 'one_month'::text; end if;
  if v_age >= interval '180 days' then v_new := v_new || 'six_months'::text; end if;
  if v_age >= interval '365 days' then v_new := v_new || 'one_year'::text; end if;
  if coalesce(v_p.streak, 0) >= 7  then v_new := v_new || 'week_streak'::text; end if;
  if coalesce(v_p.streak, 0) >= 30 then v_new := v_new || 'month_streak'::text; end if;
  if coalesce(v_p.level, 1) >= 10 then v_new := v_new || 'level_10'::text; end if;
  if coalesce(v_p.level, 1) >= 18 then v_new := v_new || 'level_20'::text; end if;
  if coalesce(v_p.level, 1) >= 24 then v_new := v_new || 'level_30'::text; end if;
  if v_rank is not null and v_sales > 0 then
    if v_rank <= 50 then v_new := v_new || 'top_50'::text; end if;
    if v_rank <= 10 then v_new := v_new || 'top_10'::text; end if;
    if v_rank = 1   then v_new := v_new || 'number_one'::text; end if;
  end if;
  if exists (select 1 from products where seller_id = p_user_id and boosted_until is not null) then
    v_new := v_new || 'boosted'::text;
  end if;

  -- keep earned badges, add the new ones (badges are never taken away)
  select array(select distinct x from unnest(v_new) x where not (x = any(v_have))) into v_new;
  if array_length(v_new, 1) > 0 then
    update profiles set unlocked_badges = v_have || v_new where id = p_user_id;
  end if;
end;
$$;
revoke execute on function public.evaluate_badges(uuid) from public, anon, authenticated;

-- level + xp for the ring on public shops (appended columns)
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
       case when sales_count >= 200 then 'platinum'
            when sales_count >= 50  then 'gold'
            when sales_count >= 10  then 'silver'
            else 'bronze' end as tier,
       (plan = 'pro' and show_pro_badge) as is_pro,
       coalesce(level, 1) as level,
       coalesce(xp, 0) as xp
from profiles;
grant select on public.public_profiles to anon, authenticated;

-- re-evaluate everyone once with the new rules (frames follow the level trigger)
do $$ declare r record; begin
  for r in select id from profiles loop
    update profiles set level = level where id = r.id;
    perform evaluate_badges(r.id);
  end loop;
end $$;
