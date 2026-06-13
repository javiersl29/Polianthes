-- ============================================================
-- E-commerce admin panels (Sprint 5+)
-- ============================================================

-- Configuración de proveedores de pago (MercadoPago y Stripe).
-- Una fila por proveedor, identificada por `provider`.
CREATE TABLE IF NOT EXISTS payment_provider_config (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('mercadopago','stripe')),
  active BOOLEAN NOT NULL DEFAULT FALSE,
  -- MercadoPago
  mp_access_token TEXT,
  mp_public_key TEXT,
  mp_webhook_secret TEXT,
  -- Stripe
  stripe_secret_key TEXT,
  stripe_publishable_key TEXT,
  stripe_webhook_secret TEXT,
  -- Modo (test o live)
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  -- Paleta / moneda
  currency TEXT NOT NULL DEFAULT 'MXN',
  -- Cuotas mínimas / máximas (sólo aplican a MP en MX)
  installments_min INTEGER NOT NULL DEFAULT 1,
  installments_max INTEGER NOT NULL DEFAULT 12,
  -- Notas internas
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Logs de búsquedas en el catálogo público (para "más buscados")
CREATE TABLE IF NOT EXISTS search_log (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL DEFAULT '',
  note_filter TEXT,
  family_filter TEXT,
  gender_filter TEXT,
  -- Fragancia clickeada después de buscar (si aplica)
  clicked_slug TEXT,
  results_count INTEGER NOT NULL DEFAULT 0,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_log_created ON search_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_log_query ON search_log(query);
CREATE INDEX IF NOT EXISTS idx_search_log_clicked ON search_log(clicked_slug);

-- Logs de recomendaciones del decoder (para "más recomendados")
CREATE TABLE IF NOT EXISTS recommendation_log (
  id BIGSERIAL PRIMARY KEY,
  -- Vector enviado por el usuario (familias + mood)
  vector_json JSONB,
  set_id TEXT,
  reference_slug TEXT,
  gender_filter TEXT,
  count_requested INTEGER,
  -- Slugs recomendados (ordenados por afinidad)
  recommended_slugs TEXT[] NOT NULL DEFAULT '{}',
  -- Fragancia clickeada de las recomendadas (si aplica)
  clicked_slug TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rec_log_created ON recommendation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_log_recommended ON recommendation_log USING GIN(recommended_slugs);
CREATE INDEX IF NOT EXISTS idx_rec_log_clicked ON recommendation_log(clicked_slug);

-- Eventos de carrito y checkout (para embudos y debugging)
CREATE TABLE IF NOT EXISTS cart_event (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL CHECK (event IN ('cart_add','cart_remove','checkout_start','checkout_success','checkout_failed')),
  session_id TEXT,
  -- Snapshot del carrito en el momento del evento (json)
  cart_json JSONB,
  -- Si hubo checkout, info del provider y monto
  provider TEXT,
  amount_cents INTEGER,
  order_id INTEGER REFERENCES "order"(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cart_event_created ON cart_event(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_event_event ON cart_event(event);

-- Columnas adicionales en `order` para soporte de multi-provider
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS provider TEXT CHECK (provider IN ('mercadopago','stripe','manual'));
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Sembrar config por defecto de payment_provider_config (idempotente)
INSERT INTO payment_provider_config (provider, mode, currency)
SELECT 'mercadopago', 'test', 'MXN'
WHERE NOT EXISTS (SELECT 1 FROM payment_provider_config WHERE provider = 'mercadopago');

INSERT INTO payment_provider_config (provider, mode, currency)
SELECT 'stripe', 'test', 'MXN'
WHERE NOT EXISTS (SELECT 1 FROM payment_provider_config WHERE provider = 'stripe');
