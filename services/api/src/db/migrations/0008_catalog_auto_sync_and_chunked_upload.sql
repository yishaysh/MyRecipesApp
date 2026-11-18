-- Migration: 0008_catalog_auto_sync_and_chunked_upload
-- Up Migration: Real Chain Catalog Sync, Store IDs, Chunked Uploads & Chain Configs

ALTER TABLE chain_import_runs ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS catalog_upload_chunks (
  id VARCHAR(128) PRIMARY KEY,
  upload_id VARCHAR(128) NOT NULL,
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS catalog_upload_chunks_idx ON catalog_upload_chunks(upload_id, chunk_index);

CREATE TABLE IF NOT EXISTS chain_catalog_configs (
  chain_key VARCHAR(64) PRIMARY KEY,
  chain_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_store_id VARCHAR(64) NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_file VARCHAR(255),
  last_item_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default chain catalog configs if not present
INSERT INTO chain_catalog_configs (chain_key, chain_id, name, enabled, preferred_store_id, notes)
VALUES
  ('shufersal', '7290027600007', 'שופרסל', TRUE, '091', 'שופרסל סניף מרכזי (091)'),
  ('rami_levy', '7290058140886', 'רמי לוי', TRUE, '001', 'רמי לוי שיווק השקמה (001)'),
  ('hazi_hinam', '7290700100008', 'חצי חינם', TRUE, '219', 'חצי חינם סניף מרכזי (219)')
ON CONFLICT (chain_key) DO NOTHING;

-- Create view for catalog_sync_runs compatibility
CREATE OR REPLACE VIEW catalog_sync_runs AS
SELECT
  id,
  chain,
  store_id AS store,
  file_name AS filename,
  rows_imported AS item_count,
  status,
  error,
  started_at,
  finished_at
FROM chain_import_runs;
