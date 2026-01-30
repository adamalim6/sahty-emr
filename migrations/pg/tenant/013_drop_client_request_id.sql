-- Migration: Drop client_request_id from stock_transfers
-- This column was redundant with demand_id for idempotency purposes

-- Drop the index first
DROP INDEX IF EXISTS idx_transfer_idempotency;

-- Drop the column
ALTER TABLE stock_transfers DROP COLUMN IF EXISTS client_request_id;

-- Create an index on demand_id for idempotency queries
CREATE INDEX IF NOT EXISTS idx_transfer_demand_idempotency ON stock_transfers(tenant_id, demand_id) 
    WHERE status = 'VALIDATED';
