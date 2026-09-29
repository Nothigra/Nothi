-- Migration: 019_promotions_and_free_claim_fix.sql
--
-- 1. SECURITY FIX — free claims.
--    The "Buyers can insert free purchases directly" policy only checked that
--    the ROW said price_paid = 0. It never checked that the PRODUCT is free,
--    so any signed-in user could grant themselves any paid product from the
--    browser console. Claims are now only allowed for published products whose
--    real price is 0, with the product's real seller.
--    (Checked before applying: no existing row abused it.)
--
-- 2. Promotions.
--    A seller can set products.sale_price (and optionally sale_ends_at).
--    A promotion is ACTIVE when 0.50 <= sale_price < price and it hasn't
--    ended. The buyer is charged the active promo price by
--    create-checkout-session; public_products exposes it as sale_price
--    (NULL when no active promotion).
--    The 0.50 EUR floor is Stripe's minimum charge and also guarantees a
--    promotion can never turn a paid product into a free-claimable one.

-- ── 1. Free-claim policy ──────────────────────────────────────────────────
-- SECURITY DEFINER: buyers can't SELECT other sellers' rows in `products`
-- (RLS), so the check must run with the owner's rights.
create or replace function public.is_free_claimable(p_product_id uuid, p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from products
    where id = p_product_id
      and seller_id = p_seller_id
      and status = 'published'
      and price = 0
  );
$$;

revoke all on function public.is_free_claimable(uuid, uuid) from public;
grant execute on function public.is_free_claimable(uuid, uuid) to authenticated;

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
  );

-- ── 2. Promotions ─────────────────────────────────────────────────────────
alter table products add column if not exists sale_ends_at timestamptz;

alter table products drop constraint if exists products_sale_price_valid;
alter table products add constraint products_sale_price_valid
  check (sale_price is null or (sale_price >= 0.5 and sale_price < price));

-- Single definition of "the price a buyer pays right now", shared by the
-- public view and the checkout Edge Function (via the view's columns).
create or replace function public.active_sale_price(p_price numeric, p_sale_price numeric, p_sale_ends_at timestamptz)
returns numeric
language sql
stable
as $$
  select case
    when p_sale_price is not null
     and p_sale_price >= 0.5
     and p_sale_price < p_price
     and (p_sale_ends_at is null or p_sale_ends_at > now())
    then p_sale_price
  end;
$$;

-- Same definition as migration 017, with two columns appended at the end
-- (CREATE OR REPLACE VIEW only allows adding columns at the end).
create or replace view public_products as
 SELECT p.id,
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
    p.boosted_until > timezone('utc'::text, now()) AS is_boosted,
    row_number() OVER (ORDER BY ((p.sales_count + 10)::numeric * (1.0 + COALESCE(p.rating, 0::numeric) / 5.0) *
        CASE
            WHEN p.boosted_until > timezone('utc'::text, now()) THEN 1.5
            ELSE 1.0
        END) DESC, p.created_at DESC) AS popular_rank,
    pr.username AS creator_username,
    pr.avatar_url AS creator_avatar,
    pr.bio AS creator_bio,
        CASE
            WHEN pr.sales_count >= 200 THEN 'platinum'::text
            WHEN pr.sales_count >= 50 THEN 'gold'::text
            WHEN pr.sales_count >= 10 THEN 'silver'::text
            ELSE 'bronze'::text
        END AS tier,
    pr.plan = 'pro'::text AND pr.show_pro_badge AS creator_is_pro,
    public.active_sale_price(p.price, p.sale_price, p.sale_ends_at) AS sale_price,
    CASE WHEN public.active_sale_price(p.price, p.sale_price, p.sale_ends_at) IS NOT NULL
         THEN p.sale_ends_at END AS sale_ends_at
   FROM products p
     JOIN profiles pr ON p.seller_id = pr.id
  WHERE p.status = 'published'::text;
