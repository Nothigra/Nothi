-- ==============================================================================
-- Migration: 004_create_purchases_table.sql
-- Description: Creates the purchases table, RLS policies, and trigger to securely 
--              sync sales_count on products and profiles.
-- ==============================================================================

-- Create purchases table
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  price_paid numeric NOT NULL,
  currency text NOT NULL,
  is_free boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'completed',
  transaction_id text,
  purchased_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  
  -- Constraint to prevent self-purchasing to farm sales counts
  CONSTRAINT no_self_purchasing CHECK (buyer_id <> seller_id)
);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Policy: Buyers can view their own purchases
CREATE POLICY "Buyers can view their own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = buyer_id);

-- Policy: Sellers can view purchases of their products
CREATE POLICY "Sellers can view purchases of their products"
  ON purchases FOR SELECT
  USING (auth.uid() = seller_id);

-- TODO: before real launch, restrict purchases INSERT to service_role only once Stripe webhook confirms real payment — remove open buyer_id = auth.uid() insert policy.
CREATE POLICY "Buyers can insert their own purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Create the trigger function to safely increment sales_count
CREATE OR REPLACE FUNCTION increment_sales_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to bypass client RLS restrictions on products/profiles
AS $$
BEGIN
  -- Increment product sales_count
  UPDATE products
  SET sales_count = coalesce(sales_count, 0) + 1
  WHERE id = NEW.product_id;

  -- Increment seller profile sales_count
  UPDATE profiles
  SET sales_count = coalesce(sales_count, 0) + 1
  WHERE id = NEW.seller_id;

  RETURN NEW;
END;
$$;

-- Create the trigger on the purchases table
CREATE TRIGGER on_purchase_created
  AFTER INSERT ON purchases
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION increment_sales_count();
