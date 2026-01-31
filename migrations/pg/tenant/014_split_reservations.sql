-- Migration: Split stock_reservations into Header + Lines
-- Purpose: Refactor flat row-per-item model into document model (header + lines)
-- 
-- Reservations = INTENT (upstream of execution)
-- Execution documents (transfers, returns, dispenses) will reference reservation lines

-- ============================================================================
-- STEP 1: Create stock_reservation_lines table
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_reservation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL,              -- FK added after migration
    tenant_id TEXT NOT NULL,
    stock_demand_line_id UUID,                 -- origin of reservation line
    product_id UUID NOT NULL,
    lot TEXT NOT NULL,
    expiry DATE NOT NULL,
    source_location_id UUID NOT NULL,          -- FK to locations
    destination_location_id UUID,              -- FK to locations (nullable)
    qty_units INTEGER NOT NULL CHECK (qty_units > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_resline_reservation ON stock_reservation_lines(reservation_id);
CREATE INDEX IF NOT EXISTS idx_resline_tenant ON stock_reservation_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resline_lookup ON stock_reservation_lines(product_id, lot, expiry, source_location_id);
CREATE INDEX IF NOT EXISTS idx_resline_demand ON stock_reservation_lines(stock_demand_line_id) WHERE stock_demand_line_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Add reservation_line_id to execution tables (for traceability)
-- ============================================================================

-- stock_transfer_lines will point TO reservation lines (not reverse)
ALTER TABLE stock_transfer_lines 
ADD COLUMN IF NOT EXISTS reservation_line_id UUID REFERENCES stock_reservation_lines(id);

-- ============================================================================
-- STEP 3: Migrate existing data (header + lines from flat rows)
-- ============================================================================

-- 3a. Insert lines from existing reservations
INSERT INTO stock_reservation_lines (
    id, reservation_id, tenant_id, stock_demand_line_id, 
    product_id, lot, expiry, source_location_id, destination_location_id, qty_units, created_at
)
SELECT 
    gen_random_uuid(),
    reservation_id,
    tenant_id,
    demand_line_id::UUID,
    product_id,
    COALESCE(lot, 'UNKNOWN'),
    COALESCE(expiry, '2099-12-31'),
    location_id::UUID,
    destination_location_id::UUID,
    qty_units,
    COALESCE(reserved_at, NOW())
FROM stock_reservations
WHERE product_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Drop deprecated columns from stock_reservations (header-only)
-- ============================================================================

-- Drop execution references (reservations must not point to executions)
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS transfer_id;
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS transfer_line_id;
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS client_request_id;

-- Drop line-level fields (now in stock_reservation_lines)
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS demand_line_id;
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS product_id;
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS lot;
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS expiry;
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS location_id;
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS destination_location_id;
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS qty_units;

-- Rename cancelled_at → released_at (single non-commit terminal state)
ALTER TABLE stock_reservations RENAME COLUMN cancelled_at TO released_at;

-- Rename demand_id → stock_demand_id for clarity
ALTER TABLE stock_reservations RENAME COLUMN demand_id TO stock_demand_id;

-- Update status constraint: ACTIVE | RELEASED | COMMITTED
ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_status_check;
ALTER TABLE stock_reservations ADD CONSTRAINT stock_reservations_status_check 
    CHECK (status IN ('ACTIVE', 'RELEASED', 'COMMITTED'));

-- Update any EXPIRED status to RELEASED (cleanup)
UPDATE stock_reservations SET status = 'RELEASED' WHERE status = 'EXPIRED';

-- ============================================================================
-- STEP 5: Add FK constraint after migration
-- ============================================================================

ALTER TABLE stock_reservation_lines 
ADD CONSTRAINT fk_resline_reservation 
FOREIGN KEY (reservation_id) REFERENCES stock_reservations(reservation_id);

-- ============================================================================
-- STEP 6: Update indexes for new header structure
-- ============================================================================

-- Drop old indexes that reference removed columns
DROP INDEX IF EXISTS idx_res_active;

-- Create new header-focused indexes
CREATE INDEX IF NOT EXISTS idx_res_session_active ON stock_reservations(tenant_id, session_id) 
    WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_res_expires ON stock_reservations(status, expires_at) 
    WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_res_demand ON stock_reservations(stock_demand_id) 
    WHERE stock_demand_id IS NOT NULL;
