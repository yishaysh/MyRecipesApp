-- v2.1.0: Curated Recipes Showcase, Collections (Curated & User), Owner Branding & User Preferences
-- Backward-compatible and idempotent migration

CREATE TABLE IF NOT EXISTS curated_recipes (
  id VARCHAR(128) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  recipe_payload JSONB NOT NULL,
  cover_image TEXT,
  collection_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS curated_recipes_published_sort_idx ON curated_recipes (published, sort_order);

CREATE TABLE IF NOT EXISTS collections (
  id VARCHAR(128) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  scope VARCHAR(32) NOT NULL DEFAULT 'curated',
  owner_user_id VARCHAR(128),
  name VARCHAR(120) NOT NULL,
  subtitle VARCHAR(80),
  description TEXT,
  icon VARCHAR(64) NOT NULL DEFAULT '🍽️',
  cover_image TEXT,
  color_gradient VARCHAR(160) NOT NULL DEFAULT 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  recipe_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS collections_scope_owner_idx ON collections (scope, owner_user_id, sort_order);

CREATE TABLE IF NOT EXISTS curated_settings (
  id VARCHAR(64) PRIMARY KEY,
  owner_name VARCHAR(120) NOT NULL DEFAULT 'מהמטבח של הבעלים',
  owner_logo_text VARCHAR(120) NOT NULL DEFAULT 'מהמטבח של הבעלים',
  owner_badge_emoji VARCHAR(16) NOT NULL DEFAULT '👨‍🍳',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO curated_settings (id, owner_name, owner_logo_text, owner_badge_emoji)
VALUES ('default', 'מהמטבח של הבעלים', 'מהמטבח של הבעלים', '👨‍🍳')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id VARCHAR(128) PRIMARY KEY,
  view_mode VARCHAR(24) NOT NULL DEFAULT 'collections',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
