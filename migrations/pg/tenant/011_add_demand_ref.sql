ALTER TABLE stock_demands ADD COLUMN IF NOT EXISTS demand_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_demand_ref ON stock_demands(demand_ref);
