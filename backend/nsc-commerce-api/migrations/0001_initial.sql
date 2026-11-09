-- Natural Studio Commerce only. Separate D1 database; no other business data is stored here.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  is_download INTEGER NOT NULL DEFAULT 0 CHECK (is_download IN (0, 1)),
  suggested_price_cents INTEGER,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = lower(currency) AND length(currency) = 3),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (suggested_price_cents IS NULL OR suggested_price_cents > 0),
  CHECK (price_cents IS NULL OR price_cents > 0),
  CHECK (status <> 'active' OR price_cents IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS product_assets (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_base64 TEXT NOT NULL,
  sha256_hex TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  email_snapshot TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (currency = lower(currency) AND length(currency) = 3),
  stripe_checkout_session_id TEXT UNIQUE,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_public_catalog_idx ON products(status, is_download);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('order', 'digital-download', 'product-question', 'accessibility', 'other')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 4000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS support_customer_created_idx ON support_requests(customer_id, created_at DESC);
