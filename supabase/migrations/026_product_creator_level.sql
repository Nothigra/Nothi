-- 026_product_creator_level.sql
-- Product cards show the creator's grade ring: expose the creator level.
-- (create or replace view: the new column is appended at the end)
create or replace view public.public_products as
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
    ((- ((p.sales_count + 10)::numeric * (1.0 + COALESCE(p.rating, 0::numeric) / 5.0) *
        CASE
            WHEN p.boosted_until > timezone('utc'::text, now()) THEN 1.5
            ELSE 1.0
        END)) * 1000::numeric)::bigint AS popular_rank,
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
    active_sale_price(p.price, p.sale_price, p.sale_ends_at) AS sale_price,
        CASE
            WHEN active_sale_price(p.price, p.sale_price, p.sale_ends_at) IS NOT NULL THEN p.sale_ends_at
            ELSE NULL::timestamp with time zone
        END AS sale_ends_at,
    p.file_size,
    p.format,
    (p.sales_count + 10)::numeric * (1.0 + COALESCE(p.rating, 0::numeric) / 5.0) *
        CASE
            WHEN p.boosted_until > timezone('utc'::text, now()) THEN 1.5
            ELSE 1.0
        END AS popular_score,
    COALESCE(active_sale_price(p.price, p.sale_price, p.sale_ends_at), p.price) AS effective_price,
    p.sales_count,
    COALESCE(pr.level, 1) AS creator_level
   FROM products p
     JOIN profiles pr ON p.seller_id = pr.id
  WHERE p.status = 'published'::text;
