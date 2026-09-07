-- Add the new media jsonb column to the products table (defaulting to empty array)
ALTER TABLE products 
ADD COLUMN media jsonb DEFAULT '[]'::jsonb;

-- Drop the view first to avoid 42P16 error since the column structure is changing
DROP VIEW IF EXISTS public_products;

-- Create the public_products view to expose the new media column
CREATE VIEW public_products AS
SELECT
  p.id,
  p.title,
  p.description,
  p.price,
  p.category,
  p.video_url, -- Kept for legacy fallback
  p.images,    -- Kept for legacy fallback
  p.media,     -- New unified media array
  p.status,
  p.seller_id,
  p.software,
  p.style,
  p.created_at,
  p.updated_at,
  p.reviews_count,
  p.rating,
  (p.boosted_until > timezone('utc'::text, now())) AS is_boosted,
  row_number() over (
    order by (
      (p.sales_count + 10) 
      * (1.0 + (coalesce(p.rating, 0) / 5.0)) 
      * (CASE WHEN p.boosted_until > timezone('utc'::text, now()) THEN 1.5 ELSE 1.0 END)
    ) desc, 
    p.created_at desc
  ) AS popular_rank,
  pr.username AS creator_username,
  pr.avatar_url AS creator_avatar,
  pr.bio AS creator_bio,
  CASE 
    WHEN pr.sales_count >= 200 THEN 'platinum'
    WHEN pr.sales_count >= 50 THEN 'gold'
    WHEN pr.sales_count >= 10 THEN 'silver'
    ELSE 'bronze'
  END AS tier
FROM products p
JOIN profiles pr ON p.seller_id = pr.id
WHERE p.status = 'published';

-- The view automatically inherits the existing GRANTs, but we can re-apply to be safe
GRANT SELECT ON public_products TO anon, authenticated;
