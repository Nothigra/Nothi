-- ==============================================================================
-- Migration: 002_create_products_table.sql
-- Description: Reconstructed schema for the initial products table and public 
--              view. This documents the original state before subsequent updates.
-- ==============================================================================

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  category text,
  video_url text,
  images text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  software text[] DEFAULT '{}',
  style text[] DEFAULT '{}',
  reviews_count integer DEFAULT 0,
  rating numeric DEFAULT 0,
  sales_count integer DEFAULT 0,
  boosted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public products are viewable by everyone."
  ON products FOR SELECT
  USING (status = 'published');

CREATE POLICY "Users can insert their own products."
  ON products FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update their own products."
  ON products FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Users can delete their own products."
  ON products FOR DELETE
  USING (auth.uid() = seller_id);

-- Create initial public_products view
CREATE VIEW public_products AS
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
  (p.boosted_until > timezone('utc'::text, now())) AS is_boosted,
  row_number() over (
    order by (
      (p.sales_count + 10) 
      * (1.0 + (coalesce(p.rating, 0) / 5.0)) 
      * (CASE WHEN p.boosted_until > timezone('utc'::text, now()) THEN 1.5 ELSE 1.0 END)
    ) desc, 
    p.created_at desc
  ) AS popular_rank,
  pr.username AS creator_name,
  pr.avatar_url AS creator_avatar,
  pr.bio AS creator_bio
FROM products p
JOIN profiles pr ON p.seller_id = pr.id
WHERE p.status = 'published';

GRANT SELECT ON public_products TO anon, authenticated;
