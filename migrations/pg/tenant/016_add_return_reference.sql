-- Add return_reference column to stock_returns
ALTER TABLE stock_returns
ADD COLUMN IF NOT EXISTS return_reference TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_returns_reference ON stock_returns(return_reference);
