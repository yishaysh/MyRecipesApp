-- Migration: 0008_catalog_auto_sync_and_chunked_upload
-- Down Migration: Rollback catalog changes

DROP VIEW IF EXISTS catalog_sync_runs;
DROP TABLE IF EXISTS chain_catalog_configs;
DROP TABLE IF EXISTS catalog_upload_chunks;
ALTER TABLE chain_import_runs DROP COLUMN IF EXISTS store_id;
