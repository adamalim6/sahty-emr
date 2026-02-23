-- ==========================================
-- 059_create_routes_catalog.sql -- tenant
-- ==========================================

CREATE TABLE IF NOT EXISTS reference.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routes_active_order ON reference.routes (is_active, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_sort_order_unique ON reference.routes (sort_order);

-- Wait, cross-database queries aren't natively supported in standard Postgres without dblink or fdw.
-- But wait! sahty_global and tenants are in the SAME instance, just different DBs.
-- Actually, wait. I will write a NodeJS script to execute this migration so it can fetch from Global Pool and insert into Tenant Pool. 
-- For the SQL file, I'll just leave it empty of data, and the execution script will populate it.
