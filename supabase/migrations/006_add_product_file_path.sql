-- ==============================================================================
-- Migration: 006_add_product_file_path.sql
-- Description: Adds a file_path column to the products table for storing the
--              object key (NOT a public URL) of the seller's downloadable file
--              in the private nothifilesproducts R2 bucket.
--
--              This column is intentionally NOT exposed in the public_products 
--              view — the raw storage path is only accessed server-side by the
--              generate-download-url Edge Function after purchase verification.
-- ==============================================================================

ALTER TABLE products
ADD COLUMN file_path text;

-- No changes to public_products view — file_path must never be exposed to clients.
