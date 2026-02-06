-- Migration: Add PARTIALLY_RECEIVED to stock_returns.status constraint
-- Date: 2026-02-03
-- 
-- This migration adds PARTIALLY_RECEIVED as a valid status for stock returns,
-- allowing the system to track returns that have been partially received.

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE stock_returns DROP CONSTRAINT IF EXISTS stock_returns_status_check;

-- Step 2: Create new CHECK constraint with PARTIALLY_RECEIVED added
ALTER TABLE stock_returns ADD CONSTRAINT stock_returns_status_check 
CHECK (status IN (
    'DRAFT', 
    'SUBMITTED', 
    'PARTIALLY_RECEIVED',  -- NEW: For returns with multiple receptions
    'CANCELLED', 
    'CLOSED'
));
