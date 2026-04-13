-- Migration 119: Add unique constraint on current_stock for upsert support.
-- The natural key is (tenant_id, product_id, lot, expiry, location_id).

ALTER TABLE current_stock
  ADD CONSTRAINT uq_current_stock_natural_key
  UNIQUE (tenant_id, product_id, lot, expiry, location_id);
