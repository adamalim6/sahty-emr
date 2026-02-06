-- Migration: Add processing status and assignment to stock_demands
ALTER TABLE stock_demands
ADD COLUMN processing_status TEXT
  CHECK (processing_status IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED'))
  DEFAULT 'OPEN';

ALTER TABLE stock_demands
ADD COLUMN assigned_user_id TEXT;

ALTER TABLE stock_demands
ADD COLUMN claimed_at TIMESTAMPTZ;
