-- Add reception_reference column to return_receptions
ALTER TABLE return_receptions
ADD COLUMN IF NOT EXISTS reception_reference TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_return_receptions_reference ON return_receptions(reception_reference);
