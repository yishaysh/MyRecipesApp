-- Migration: 0007_round7_sharing_and_referrals (Rollback / Down)

DROP TABLE IF EXISTS conversion_ledger;
DROP TABLE IF EXISTS affiliate_click_tokens;
DROP TABLE IF EXISTS ingredient_mappings;
DROP TABLE IF EXISTS merchant_audit_logs;
DROP TABLE IF EXISTS merchant_sample_checks;
DROP TABLE IF EXISTS merchants;
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS share_reports;
DROP TABLE IF EXISTS saved_recipe_origins;
DROP TABLE IF EXISTS share_snapshots;
DROP TABLE IF EXISTS share_links;
