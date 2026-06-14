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

-- Asegurar columnas que pueden faltar si la tabla "order" fue creada
-- en una versión anterior del schema (CREATE TABLE IF NOT EXISTS no
-- actualiza tablas existentes).
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS promotion_id INTEGER REFERENCES promotion(id) ON DELETE SET NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS mp_preference_id TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS mp_status TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;

-- Tabla para configuración de notificaciones (SMTP o Resend)
CREATE TABLE IF NOT EXISTS email_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend','smtp','none')),
  from_email TEXT NOT NULL DEFAULT 'noreply@polianthes.mx',
  from_name TEXT NOT NULL DEFAULT 'Polianthes',
  resend_api_key TEXT,
  smtp_host TEXT,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  -- Notificaciones al administrador
  admin_email TEXT,
  notify_admin_new_order BOOLEAN NOT NULL DEFAULT TRUE,
  -- Notificaciones al cliente
  notify_customer_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  notify_customer_shipped BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row_email CHECK (id = 1)
);

-- Columnas nuevas (idempotentes para instalaciones existentes)
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS admin_email TEXT;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS notify_admin_new_order BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS notify_customer_confirmation BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS notify_customer_shipped BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO email_config (id, provider)
SELECT 1, 'none'
WHERE NOT EXISTS (SELECT 1 FROM email_config WHERE id = 1);

-- Extender shipping_zone para soportar pickup (entrega física) además
-- de zonas por CP. El campo `kind` distingue ambos tipos. Las columnas
-- pickup_* sólo aplican cuando kind = 'pickup'.
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'shipping' CHECK (kind IN ('shipping','pickup'));
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS pickup_city TEXT;
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS pickup_state TEXT;
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS pickup_postal_code TEXT;
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS pickup_schedule TEXT;
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(9,6);
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(9,6);
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE shipping_zone ADD COLUMN IF NOT EXISTS email TEXT;

-- Sembrar config por defecto de payment_provider_config (idempotente)
INSERT INTO payment_provider_config (provider, mode, currency)
SELECT 'mercadopago', 'test', 'MXN'
WHERE NOT EXISTS (SELECT 1 FROM payment_provider_config WHERE provider = 'mercadopago');

INSERT INTO payment_provider_config (provider, mode, currency)
SELECT 'stripe', 'test', 'MXN'
WHERE NOT EXISTS (SELECT 1 FROM payment_provider_config WHERE provider = 'stripe');

-- ============================================================
-- Reseñas públicas por fragancia
-- ============================================================
CREATE TABLE IF NOT EXISTS review (
  id BIGSERIAL PRIMARY KEY,
  fragrance_id INTEGER NOT NULL REFERENCES fragrance(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  -- Moderación: pending | approved | rejected
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  -- Metadatos del comprador (si aplica)
  verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  order_id INTEGER REFERENCES "order"(id) ON DELETE SET NULL,
  admin_response TEXT,
  -- Datos de moderación
  rejected_reason TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by INTEGER REFERENCES admin_user(id),
  -- Anti-spam
  ip_hash TEXT,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','imported','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_fragrance ON review(fragrance_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_review_status ON review(status);
CREATE INDEX IF NOT EXISTS idx_review_created ON review(created_at DESC);

-- ============================================================
-- Enlaces del menú principal (Navbar + Footer)
-- ============================================================
CREATE TABLE IF NOT EXISTS nav_link (
  id SERIAL PRIMARY KEY,
  -- En qué barra se muestra
  location TEXT NOT NULL DEFAULT 'navbar' CHECK (location IN ('navbar','footer','mobile')),
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  -- Orden de aparición (ascendente)
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Icono opcional (emoji o path de svg)
  icon TEXT,
  -- Abrir en nueva pestaña
  new_tab BOOLEAN NOT NULL DEFAULT FALSE,
  -- Requerir estar autenticado (admin) para ver
  admin_only BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nav_link_location ON nav_link(location, active, sort_order);

-- Seed idempotente del menú por defecto
INSERT INTO nav_link (location, label, href, sort_order)
SELECT 'navbar', 'Inicio', '/', 0
WHERE NOT EXISTS (SELECT 1 FROM nav_link WHERE location = 'navbar' AND href = '/');

INSERT INTO nav_link (location, label, href, sort_order)
SELECT 'navbar', 'Decodificador', '/#decodificador', 10
WHERE NOT EXISTS (SELECT 1 FROM nav_link WHERE location = 'navbar' AND href = '/#decodificador');

INSERT INTO nav_link (location, label, href, sort_order)
SELECT 'navbar', 'Capacidades', '/#capacidades', 20
WHERE NOT EXISTS (SELECT 1 FROM nav_link WHERE location = 'navbar' AND href = '/#capacidades');

INSERT INTO nav_link (location, label, href, sort_order)
SELECT 'navbar', 'Catálogo', '/#catalogo', 30
WHERE NOT EXISTS (SELECT 1 FROM nav_link WHERE location = 'navbar' AND href = '/#catalogo');

INSERT INTO nav_link (location, label, href, sort_order)
SELECT 'footer', 'Panel admin', '/admin', 0
WHERE NOT EXISTS (SELECT 1 FROM nav_link WHERE location = 'footer' AND href = '/admin');

INSERT INTO nav_link (location, label, href, sort_order, new_tab)
SELECT 'footer', 'Código fuente', 'https://github.com/javiersl29/Polianthes', 10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nav_link WHERE location = 'footer' AND href = 'https://github.com/javiersl29/Polianthes');
