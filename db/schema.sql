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
