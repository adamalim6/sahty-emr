-- PostgreSQL Tenant Schema Additions for TIER 2
-- Run this after 000_init.sql to add missing columns for reservation engine

-- Add destination_location_id to stock_reservations
ALTER TABLE stock_reservations 
ADD COLUMN IF NOT EXISTS destination_location_id TEXT;

-- Add source_location_id and destination_location_id to stock_transfer_lines
ALTER TABLE stock_transfer_lines 
ADD COLUMN IF NOT EXISTS source_location_id TEXT;

ALTER TABLE stock_transfer_lines 
ADD COLUMN IF NOT EXISTS destination_location_id TEXT;

-- Add client_request_id to stock_transfers for idempotency
ALTER TABLE stock_transfers 
ADD COLUMN IF NOT EXISTS client_request_id TEXT;

-- Add 'POSTED' as valid status for stock_transfers
-- Note: Can't easily modify CHECK constraint, but we can work around or drop/recreate
-- For now, let's update the code to use 'VALIDATED' instead of 'POSTED'

-- Ensure proper indexes
CREATE INDEX IF NOT EXISTS idx_transfer_idempotency ON stock_transfers(tenant_id, client_request_id) 
    WHERE client_request_id IS NOT NULL;
