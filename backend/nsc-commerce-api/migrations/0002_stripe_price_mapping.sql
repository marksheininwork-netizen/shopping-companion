-- Pin each saleable NSC product to its separately approved Stripe Price.
ALTER TABLE products ADD COLUMN stripe_price_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS products_stripe_price_id_unique ON products(stripe_price_id) WHERE stripe_price_id IS NOT NULL;
