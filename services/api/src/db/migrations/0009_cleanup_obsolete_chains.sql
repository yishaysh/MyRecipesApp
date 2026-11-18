-- Migration: 0009_cleanup_obsolete_chains
-- Up Migration: Purge rows belonging to chains outside the active supported set

DELETE FROM chain_catalog_configs
WHERE chain_key NOT IN ('shufersal', 'rami_levy', 'hazi_hinam');

DELETE FROM chain_products
WHERE chain NOT IN ('shufersal', 'rami_levy', 'hazi_hinam');

DELETE FROM chain_import_runs
WHERE chain NOT IN ('shufersal', 'rami_levy', 'hazi_hinam');

DELETE FROM ingredient_mapping_suggestions
WHERE chain NOT IN ('shufersal', 'rami_levy', 'hazi_hinam');

DELETE FROM merchants
WHERE id NOT IN ('shufersal', 'rami_levy', 'hazi_hinam');

UPDATE merchants
SET display_order = 3
WHERE id = 'hazi_hinam';
