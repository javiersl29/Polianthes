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
  image_data TEXT,
  inspiration_image_url TEXT,
  original_image_data TEXT,
  original_image_source TEXT,
  original_image_url TEXT,
  original_image_fetched_at TIMESTAMPTZ,
  use_brand_bottle_override BOOLEAN NOT NULL DEFAULT FALSE,
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

-- Defaults globales de precio/stock/SKU por tamaño (aplica a todas las fragancias)
CREATE TABLE IF NOT EXISTS pricing_defaults (
  size_ml INTEGER PRIMARY KEY,
  price_cents INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 100,
  sku_prefix TEXT NOT NULL DEFAULT 'PLT',
  display_order INTEGER NOT NULL DEFAULT 0
);

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

-- Configuración global de envío (single-row, override/ fallback)
CREATE TABLE IF NOT EXISTS shipping_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  -- Costo flat por defecto cuando no hay match de zona por CP
  default_cost_cents INTEGER NOT NULL DEFAULT 0,
  -- Envío gratis si subtotal pre-promo >= N (NULL = nunca gratis por defecto)
  default_free_from_cents INTEGER,
  -- Tiempo estimado cuando aplica la regla por defecto
  default_estimated_days TEXT,
  -- Override global: si está activo, ignora zonas y cobra siempre este costo
  override_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  override_cost_cents INTEGER,
  override_free_from_cents INTEGER,
  override_estimated_days TEXT,
  -- Mensaje mostrado al cliente en checkout cuando aplica override
  override_label TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row_shipping_config CHECK (id = 1)
);

-- Sembrar fila única
INSERT INTO shipping_config (id, default_cost_cents, override_enabled, active)
VALUES (1, 0, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Promociones del mes (carrusel en homepage)
CREATE TABLE IF NOT EXISTS promotion (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  -- Tipo de promo:
  --   3x2, 2x1          → lleva N paga M (mismo tamaño)
  --   bundle_qty        → lleva N unidades por $X (pueden ser tamaños mezclados)
  --   bundle_mix        → N unidades de tamaño A + M de tamaño B por $X (mixto)
  --   second_unit       → 2da unidad a X% (descuento en la 2da)
  --   percent           → X% de descuento sobre el total
  --   fixed             → $X de descuento fijo
  --   free_shipping     → envío gratis
  --   tiered            → tier por cantidad (1=$A, 2=$B, 3=$C)
  type TEXT NOT NULL DEFAULT 'bundle'
    CHECK (type IN ('3x2','2x1','bundle_qty','bundle_mix','second_unit','percent','fixed','bundle','free_shipping','tiered')),
  -- Valor del descuento (percent 0-100, fixed en cents, o % 2da unidad)
  value INTEGER NOT NULL DEFAULT 0,
  -- Precio fijo del bundle en centavos (para bundle_qty/bundle_mix: "3 por $290")
  bundle_price_cents INTEGER NOT NULL DEFAULT 0,
  -- Size ml requerido (ej 60 para "perfumes 60ml"). 0 = cualquier tamaño
  required_size_ml INTEGER NOT NULL DEFAULT 0,
  -- Si se permiten tamaños mezclados (para bundle_qty)
  -- 0 = mismo tamaño, 1 = cualquier tamaño
  mix_sizes BOOLEAN NOT NULL DEFAULT FALSE,
  -- Configuración del bundle mixto (JSONB). Array de {size_ml, qty}
  -- Ej: [{"size_ml": 30, "qty": 2}, {"size_ml": 10, "qty": 1}] para "2 de 30ml + 1 de 10ml"
  mix_config JSONB,
  -- Cantidad de productos que se llevan (3x2 = 3, bundle_qty = 3, tiered = max tier)
  quantity_to_take INTEGER NOT NULL DEFAULT 3,
  -- Cantidad que pagan (3x2 = 2)
  quantity_to_pay INTEGER NOT NULL DEFAULT 2,
  -- Imagen promocional
  image_url TEXT,
  -- Generada por IA: prompt, seed
  image_prompt TEXT,
  image_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  -- Banner secundario (gradiente, label)
  badge_text TEXT,
  badge_color TEXT NOT NULL DEFAULT 'gold' CHECK (badge_color IN ('gold','rose','sky','emerald','violet')),
  -- Restricciones
  min_items INTEGER NOT NULL DEFAULT 0,
  max_items INTEGER NOT NULL DEFAULT 0, -- 0 = sin límite
  -- Pedido mínimo para que la promo aplique (en centavos, 0 = sin mínimo)
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  -- Vigencia
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  -- Estado
  active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Orden en el carrusel
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promotion_active ON promotion(active, sort_order) WHERE active = TRUE;

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

-- Clientes con cuenta (login con Google o email)
CREATE TABLE IF NOT EXISTS customer (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  picture_url TEXT,
  phone TEXT,
  birth_date DATE,
  -- Confirmación de email
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token TEXT,
  verification_expires_at TIMESTAMPTZ,
  -- Recuperación de contraseña
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  -- Dirección predeterminada (la que se usa en checkout si hay sesión)
  default_address_line TEXT,
  default_address_line2 TEXT,
  default_city TEXT,
  default_state TEXT,
  default_postal_code TEXT,
  default_country TEXT DEFAULT 'MX',
  -- Estado del cliente
  affiliated BOOLEAN NOT NULL DEFAULT FALSE,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent_cents BIGINT NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_google_id ON customer(google_id);
CREATE INDEX IF NOT EXISTS idx_customer_email ON customer(email);

-- Vincula órdenes con la cuenta del cliente (nullable: órdenes guest no tienen cuenta)
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customer(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_order_customer ON "order"(customer_id) WHERE customer_id IS NOT NULL;

-- Hilo de emails enviados al cliente por orden (admin → cliente y sistema → cliente)
CREATE TABLE IF NOT EXISTS order_email (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  kind TEXT NOT NULL DEFAULT 'manual'
    CHECK (kind IN ('manual','confirmation','shipped','cancelled','refunded','delivered','status_update','system')),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  ok BOOLEAN NOT NULL DEFAULT TRUE,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_email_order ON order_email(order_id, sent_at DESC);

-- Auditoría de redenciones de cupón
CREATE TABLE IF NOT EXISTS coupon_redemption (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupon(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemption_coupon ON coupon_redemption(coupon_id);

-- Configuración del proveedor de imágenes (MiniMax u otro compatible)
CREATE TABLE IF NOT EXISTS image_api_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'minimax',
  endpoint TEXT NOT NULL DEFAULT 'https://api.minimax.io/v1/image_generation',
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'image-01',
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  response_format TEXT NOT NULL DEFAULT 'url' CHECK (response_format IN ('url','base64')),
  prompt_optimizer BOOLEAN NOT NULL DEFAULT FALSE,
  n INTEGER NOT NULL DEFAULT 1 CHECK (n BETWEEN 1 AND 9),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  gemini_api_key TEXT,
  serper_api_key TEXT,
  zai_api_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row_image_config CHECK (id = 1)
);

-- Imagen de la botella de la marca (referencia para todas las generaciones)
CREATE TABLE IF NOT EXISTS brand_bottle_image (
  id INTEGER PRIMARY KEY DEFAULT 1,
  image_data TEXT,
  filename TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row_brand_bottle CHECK (id = 1)
);

