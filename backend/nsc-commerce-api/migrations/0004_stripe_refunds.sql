-- Persist the Stripe PaymentIntent link so verified refunds can revoke full-refund entitlements.
ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN refunded_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_intent_unique_idx ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
