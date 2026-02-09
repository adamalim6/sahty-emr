-- Additional Indexes for PostgreSQL Tenant Schema
-- These are supplementary indexes identified by the migration audit

-- ============================================================================
-- FK INDEXES (Missing in SQLite, required for PG performance)
-- ============================================================================

-- delivery_note_items already has idx_dni_note (added in 000_init.sql)
-- delivery_note_layers FK index
CREATE INDEX IF NOT EXISTS idx_dnl_note ON delivery_note_layers(delivery_note_id);

-- po_items FK index  
CREATE INDEX IF NOT EXISTS idx_poi_po ON po_items(po_id);

-- service_units FK index
CREATE INDEX IF NOT EXISTS idx_su_service ON service_units(service_id);

-- rooms FK index
CREATE INDEX IF NOT EXISTS idx_rooms_service ON rooms(service_id);

-- ============================================================================
-- QUERY OPTIMIZATION INDEXES
-- ============================================================================

-- Stock queries by product + location (common pattern)
CREATE INDEX IF NOT EXISTS idx_stock_prod_loc ON current_stock(tenant_id, product_id, location_id);

-- Stock queries by expiry (FEFO sorting)
CREATE INDEX IF NOT EXISTS idx_stock_fefo ON current_stock(tenant_id, location_id, expiry, product_id);

-- Reservation cleanup job (find expired)
CREATE INDEX IF NOT EXISTS idx_res_cleanup ON stock_reservations(expires_at) 
    WHERE status = 'ACTIVE';

-- Movement history lookups
CREATE INDEX IF NOT EXISTS idx_mov_product ON inventory_movements(product_id, created_at DESC);

-- Prescription lookups by status
CREATE INDEX IF NOT EXISTS idx_rx_status ON prescriptions(tenant_id, status);

-- Active locations only
CREATE INDEX IF NOT EXISTS idx_loc_active ON locations(tenant_id, status) 
    WHERE status = 'ACTIVE';

-- Product configs - enabled products
CREATE INDEX IF NOT EXISTS idx_config_enabled ON product_configs(tenant_id, is_enabled) 
    WHERE is_enabled = TRUE;
