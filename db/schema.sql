CREATE TABLE IF NOT EXISTS fragrance (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  family TEXT,
  mood TEXT,
  gender TEXT NOT NULL DEFAULT 'unisex',
  top_notes TEXT[] DEFAULT '{}',
  heart_notes TEXT[] DEFAULT '{}',
  base_notes TEXT[] DEFAULT '{}',
  vec_floral INTEGER NOT NULL DEFAULT 50,
  vec_oriental INTEGER NOT NULL DEFAULT 50,
  vec_amaderado INTEGER NOT NULL DEFAULT 50,
  vec_chipre INTEGER NOT NULL DEFAULT 50,
  vec_citrico INTEGER NOT NULL DEFAULT 50,
  vec_gourmand INTEGER NOT NULL DEFAULT 50,
  vec_frescura INTEGER NOT NULL DEFAULT 50,
  vec_misterio INTEGER NOT NULL DEFAULT 50,
  vec_romantico INTEGER NOT NULL DEFAULT 50,
  vec_energia INTEGER NOT NULL DEFAULT 50,
  vec_sofisticado INTEGER NOT NULL DEFAULT 50,
  vec_nostalgico INTEGER NOT NULL DEFAULT 50,
  vector_justification JSONB,
  image_url TEXT,
  inspiration_image_url TEXT,
  enriched_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fragrance_gender_check CHECK (gender IN ('hombre', 'mujer', 'unisex'))
);

CREATE INDEX IF NOT EXISTS idx_fragrance_brand ON fragrance(brand);
CREATE INDEX IF NOT EXISTS idx_fragrance_active ON fragrance(active);

CREATE TABLE IF NOT EXISTS presentation (
  id SERIAL PRIMARY KEY,
  fragrance_id INTEGER NOT NULL REFERENCES fragrance(id) ON DELETE CASCADE,
  size_ml INTEGER NOT NULL,
  price_cents INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (fragrance_id, size_ml)
);

CREATE INDEX IF NOT EXISTS idx_presentation_fragrance ON presentation(fragrance_id);

CREATE TABLE IF NOT EXISTS admin_user (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  base_url TEXT,
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT,
  temperature NUMERIC(3, 2) NOT NULL DEFAULT 0.7,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- ============================================================
-- E-commerce (Sprint 1+)
-- ============================================================

-- Zonas de envío por prefijo de código postal
CREATE TABLE IF NOT EXISTS shipping_zone (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  postal_code_prefix TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  free_from_cents INTEGER,
  estimated_days TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipping_zone_prefix ON shipping_zone(postal_code_prefix) WHERE active;

-- Cupones de descuento
CREATE TABLE IF NOT EXISTS coupon (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value INTEGER NOT NULL,
  min_subtotal_cents INTEGER,
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Promociones automáticas
CREATE TABLE IF NOT EXISTS promotion (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bxgy','percent_category','free_shipping_over','fixed_off_over')),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  stackable BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Órdenes
CREATE TABLE IF NOT EXISTS "order" (
  id SERIAL PRIMARY KEY,
  public_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled','refunded','in_transit','delivered')),
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  shipping_zone_name TEXT NOT NULL,
  shipping_address_line TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'MX',
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  coupon_code TEXT,
  promotion_id INTEGER REFERENCES promotion(id) ON DELETE SET NULL,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_status TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_status ON "order"(status);
CREATE INDEX IF NOT EXISTS idx_order_email ON "order"(customer_email);
CREATE INDEX IF NOT EXISTS idx_order_created ON "order"(created_at DESC);

-- Items de la orden (snapshot del producto al momento de la compra)
CREATE TABLE IF NOT EXISTS order_item (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  fragrance_id INTEGER NOT NULL REFERENCES fragrance(id) ON DELETE RESTRICT,
  fragrance_slug TEXT NOT NULL,
  fragrance_brand TEXT NOT NULL,
  fragrance_name TEXT NOT NULL,
  size_ml INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  line_total_cents INTEGER NOT NULL,
  fragrance_image_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item(order_id);

-- Auditoría de redenciones de cupón
CREATE TABLE IF NOT EXISTS coupon_redemption (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupon(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemption_coupon ON coupon_redemption(coupon_id);

