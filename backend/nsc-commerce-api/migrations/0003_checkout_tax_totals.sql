-- Store the Stripe-calculated tax and total separately from the approved tax-exclusive product price.
ALTER TABLE orders ADD COLUMN tax_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount_cents >= 0);
ALTER TABLE orders ADD COLUMN total_amount_cents INTEGER CHECK (total_amount_cents IS NULL OR total_amount_cents >= amount_cents);
