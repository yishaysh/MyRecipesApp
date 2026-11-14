-- Migration: 0007_round7_sharing_and_referrals
-- Up Migration: Adds Growth Engine Phase A (Sharing) & Phase B (Merchant Registry / Referral Foundation)

CREATE TABLE IF NOT EXISTS share_links (
  id VARCHAR(128) PRIMARY KEY,
  owner_user_id VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  current_snapshot_id VARCHAR(128) NOT NULL,
  source_recipe_id VARCHAR(128),
  og_consent BOOLEAN NOT NULL DEFAULT FALSE,
  sharer_display_name VARCHAR(255),
  book_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS share_links_token_hash_idx ON share_links(token_hash);
CREATE INDEX IF NOT EXISTS share_links_owner_user_idx ON share_links(owner_user_id);
CREATE INDEX IF NOT EXISTS share_links_source_recipe_idx ON share_links(source_recipe_id);

CREATE TABLE IF NOT EXISTS share_snapshots (
  id VARCHAR(128) PRIMARY KEY,
  share_id VARCHAR(128) NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  recipe_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS share_snapshots_share_version_idx ON share_snapshots(share_id, snapshot_version);

CREATE TABLE IF NOT EXISTS saved_recipe_origins (
  id VARCHAR(128) PRIMARY KEY,
  recipient_user_id VARCHAR(128) NOT NULL,
  saved_recipe_id VARCHAR(128) NOT NULL,
  source_share_id VARCHAR(128) NOT NULL,
  source_snapshot_id VARCHAR(128) NOT NULL,
  source_snapshot_version INTEGER NOT NULL,
  source_recipe_id VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(255),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_origins_recipient_share_recipe_idx
  ON saved_recipe_origins(recipient_user_id, source_share_id, source_recipe_id);

CREATE TABLE IF NOT EXISTS share_reports (
  id VARCHAR(128) PRIMARY KEY,
  share_id VARCHAR(128) NOT NULL,
  reason VARCHAR(128) NOT NULL,
  details TEXT,
  reporter_ip_hash VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS share_reports_share_id_idx ON share_reports(share_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id VARCHAR(128) PRIMARY KEY,
  event_name VARCHAR(64) NOT NULL,
  opaque_user_id VARCHAR(128),
  share_id VARCHAR(128),
  snapshot_version INTEGER,
  merchant_id VARCHAR(64),
  click_id VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx ON analytics_events(event_name, created_at);

CREATE TABLE IF NOT EXISTS merchants (
  id VARCHAR(64) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'disabled',
  kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 1,
  search_url_template TEXT NOT NULL,
  allowed_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  utm_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_items_per_link INTEGER NOT NULL DEFAULT 1,
  commercial_agreement JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_sample_checks (
  id VARCHAR(128) PRIMARY KEY,
  merchant_id VARCHAR(64) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  tested_queries JSONB NOT NULL,
  sample_urls JSONB NOT NULL,
  verified_by VARCHAR(128) NOT NULL,
  notes TEXT,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_audit_logs (
  id VARCHAR(128) PRIMARY KEY,
  merchant_id VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor VARCHAR(128) NOT NULL,
  previous_state JSONB NOT NULL,
  next_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredient_mappings (
  id VARCHAR(128) PRIMARY KEY,
  normalized_name VARCHAR(255) NOT NULL,
  merchant_id VARCHAR(64) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku VARCHAR(128) NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingredient_mappings_name_merchant_idx
  ON ingredient_mappings(normalized_name, merchant_id);

CREATE TABLE IF NOT EXISTS affiliate_click_tokens (
  token VARCHAR(128) PRIMARY KEY,
  merchant_id VARCHAR(64) NOT NULL,
  normalized_query TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  share_id VARCHAR(128),
  recipe_id VARCHAR(128),
  disclosure_mode VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversion_ledger (
  id VARCHAR(128) PRIMARY KEY,
  partner VARCHAR(64) NOT NULL,
  order_id VARCHAR(128) NOT NULL,
  click_id VARCHAR(128) NOT NULL,
  status VARCHAR(64) NOT NULL,
  replay_key VARCHAR(255) NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
