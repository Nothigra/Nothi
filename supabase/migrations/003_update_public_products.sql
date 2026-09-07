-- Recreate the public_products view to include the tier field directly from profiles
CREATE OR REPLACE VIEW public_products AS
SELECT
  p.id,
  p.title,
  p.description,
  p.price,
  p.category,
  p.video_url,
  p.images,
  p.status,
  p.seller_id,
  p.software,
  p.style,
  p.created_at,
  p.updated_at,
  p.reviews_count,
  p.rating,
  p.is_boosted,
  p.popular_rank,
  pr.username AS creator_name,
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

-- Grant access to public view
GRANT SELECT ON public_products TO anon, authenticated;
