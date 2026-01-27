-- PostgreSQL Tenant Schema for Sahty EMR
-- Database: tenant_{tenant_id}

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. INVENTORY DOMAIN
-- ============================================================================

-- 1.1 Master Movement Log (Append-Only Event Store)
CREATE TABLE IF NOT EXISTS inventory_movements (
    movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,
    lot TEXT NOT NULL,
    expiry DATE NOT NULL,
    qty_units INTEGER NOT NULL,  -- negative = out, positive = in
    from_location TEXT,
    to_location TEXT,
    document_type TEXT NOT NULL CHECK (document_type IN (
        'DELIVERY', 'DELIVERY_INJECTION', 'REPLENISHMENT', 'DISPENSE', 
        'RETURN_SUPPLIER', 'RETURN_WARD', 'WASTE', 'DESTRUCTION', 
        'BORROW_IN', 'BORROW_OUT', 'TRANSFER_OUT', 'TRANSFER_IN',
        'HOLD', 'RELEASE', 'COMMIT'
    )),
    document_id TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mov_tenant ON inventory_movements(tenant_id);
CREATE INDEX idx_mov_prod_lot_exp ON inventory_movements(tenant_id, product_id, lot, expiry);
CREATE INDEX idx_mov_doc ON inventory_movements(tenant_id, document_type, document_id);
CREATE INDEX idx_mov_created ON inventory_movements(created_at);

-- 1.2 Current Stock Snapshot (Projection from Movements)
CREATE TABLE IF NOT EXISTS current_stock (
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,
    lot TEXT NOT NULL,
    expiry DATE NOT NULL,
    location TEXT NOT NULL,
    qty_units INTEGER NOT NULL CHECK (qty_units >= 0),
    PRIMARY KEY (tenant_id, product_id, lot, location)
);

CREATE INDEX idx_stock_loc ON current_stock(tenant_id, location);
CREATE INDEX idx_stock_prod ON current_stock(tenant_id, product_id);
CREATE INDEX idx_stock_expiry ON current_stock(expiry);

-- 1.3 WAC / CMUP Table
CREATE TABLE IF NOT EXISTS product_wac (
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,
    wac NUMERIC(12,4) NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, product_id)
);

-- 1.4 Stock Reservations (Hold Engine)
CREATE TABLE IF NOT EXISTS stock_reservations (
    reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    demand_id TEXT,
    demand_line_id TEXT,
    product_id UUID NOT NULL,
    lot TEXT,
    expiry DATE,
    location_id TEXT NOT NULL,
    qty_units INTEGER NOT NULL CHECK (qty_units > 0),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED', 'COMMITTED', 'EXPIRED')),
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    committed_at TIMESTAMPTZ,
    transfer_id TEXT,
    transfer_line_id TEXT,
    client_request_id TEXT
);

CREATE INDEX idx_res_active ON stock_reservations(tenant_id, location_id, product_id, lot, expiry) 
    WHERE status = 'ACTIVE';
CREATE INDEX idx_res_session ON stock_reservations(tenant_id, session_id) 
    WHERE status = 'ACTIVE';
CREATE INDEX idx_res_expires ON stock_reservations(status, expires_at) 
    WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX idx_res_idempotency ON stock_reservations(tenant_id, client_request_id) 
    WHERE client_request_id IS NOT NULL;

-- ============================================================================
-- 2. PROCUREMENT DOMAIN
-- ============================================================================

-- 2.1 Delivery Notes
CREATE TABLE IF NOT EXISTS delivery_notes (
    delivery_note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    po_id UUID,
    received_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUARANTINE', 'PROCESSED', 'CANCELLED')),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dn_tenant ON delivery_notes(tenant_id);
CREATE INDEX idx_dn_status ON delivery_notes(status);

-- 2.2 Delivery Note Items (Pending quarantine items)
CREATE TABLE IF NOT EXISTS delivery_note_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    delivery_note_id UUID NOT NULL REFERENCES delivery_notes(delivery_note_id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    qty_pending INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dni_note ON delivery_note_items(delivery_note_id);

-- 2.3 Delivery Note Layers (Cost Traceability)
CREATE TABLE IF NOT EXISTS delivery_note_layers (
    delivery_note_id UUID NOT NULL REFERENCES delivery_notes(delivery_note_id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,
    lot TEXT NOT NULL,
    expiry DATE NOT NULL,
    qty_received INTEGER NOT NULL,
    qty_remaining INTEGER NOT NULL,
    purchase_unit_cost NUMERIC(12,4),
    PRIMARY KEY (delivery_note_id, product_id, lot)
);

-- 2.4 Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_po_tenant ON purchase_orders(tenant_id);
CREATE INDEX idx_po_status ON purchase_orders(status);

-- 2.5 Purchase Order Items
CREATE TABLE IF NOT EXISTS po_items (
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,
    qty_ordered INTEGER NOT NULL,
    qty_delivered INTEGER DEFAULT 0,
    qty_to_be_delivered INTEGER DEFAULT 0,
    unit_price NUMERIC(12,4),
    PRIMARY KEY (po_id, product_id)
);

-- ============================================================================
-- 3. STOCK DEMANDS & TRANSFERS DOMAIN
-- ============================================================================

-- 3.1 Stock Demands (Service -> Pharmacy)
CREATE TABLE IF NOT EXISTS stock_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED'
    )),
    priority TEXT DEFAULT 'ROUTINE' CHECK (priority IN ('ROUTINE', 'URGENT')),
    requested_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_demand_tenant ON stock_demands(tenant_id);
CREATE INDEX idx_demand_service ON stock_demands(service_id);
CREATE INDEX idx_demand_status ON stock_demands(status);

-- 3.2 Stock Demand Lines
CREATE TABLE IF NOT EXISTS stock_demand_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id UUID NOT NULL REFERENCES stock_demands(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,
    qty_requested INTEGER NOT NULL CHECK (qty_requested > 0),
    qty_allocated INTEGER DEFAULT 0,
    qty_transferred INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_demand_line_demand ON stock_demand_lines(demand_id);

-- 3.3 Stock Transfers
CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    demand_id UUID REFERENCES stock_demands(id),
    source_location_id TEXT NOT NULL,
    destination_location_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VALIDATED', 'COMPLETED', 'CANCELLED')),
    validated_at TIMESTAMPTZ,
    validated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfer_tenant ON stock_transfers(tenant_id);
CREATE INDEX idx_transfer_demand ON stock_transfers(demand_id);

-- 3.4 Stock Transfer Lines
CREATE TABLE IF NOT EXISTS stock_transfer_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,
    lot TEXT NOT NULL,
    expiry DATE NOT NULL,
    qty_transferred INTEGER NOT NULL CHECK (qty_transferred > 0),
    demand_line_id UUID REFERENCES stock_demand_lines(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfer_line_transfer ON stock_transfer_lines(transfer_id);

-- ============================================================================
-- 4. SETTINGS DOMAIN
-- ============================================================================

-- 4.1 Users (Tenant-level)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT,
    nom TEXT,
    prenom TEXT,
    user_type TEXT,
    role_id UUID,
    inpe TEXT,
    service_ids JSONB,  -- Array of service IDs
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_client ON users(client_id);
CREATE INDEX idx_users_username ON users(username);

-- 4.2 Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    permissions JSONB,
    modules JSONB
);

-- 4.3 Services
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT
);

CREATE INDEX idx_services_tenant ON services(tenant_id);

-- 4.4 Service Units
CREATE TABLE IF NOT EXISTS service_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    capacity INTEGER DEFAULT 0
);

-- 4.5 Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id),
    number TEXT NOT NULL,
    section TEXT,
    is_occupied BOOLEAN DEFAULT FALSE,
    type TEXT
);

-- 4.6 Locations (Pharmacy & Service Storage)
CREATE TABLE IF NOT EXISTS locations (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    scope TEXT CHECK (scope IN ('PHARMACY', 'SERVICE')),
    service_id UUID REFERENCES services(id),
    is_active BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loc_tenant ON locations(tenant_id);
CREATE INDEX idx_loc_service ON locations(service_id);

-- 4.7 Suppliers (Local tenant suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. EMR DOMAIN
-- ============================================================================

-- 5.1 Admissions
CREATE TABLE IF NOT EXISTS admissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    patient_id UUID NOT NULL,  -- References global patients
    nda TEXT,
    reason TEXT,
    service_id UUID REFERENCES services(id),
    admission_date TIMESTAMPTZ NOT NULL,
    discharge_date TIMESTAMPTZ,
    doctor_name TEXT,
    room_number TEXT,
    bed_label TEXT,
    status TEXT CHECK (status IN ('ACTIVE', 'DISCHARGED', 'TRANSFERRED')),
    currency TEXT DEFAULT 'MAD',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adm_tenant ON admissions(tenant_id);
CREATE INDEX idx_adm_patient ON admissions(patient_id);
CREATE INDEX idx_adm_status ON admissions(status);

-- 5.2 Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    patient_id UUID NOT NULL,
    admission_id UUID REFERENCES admissions(id),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    data JSONB,  -- Full prescription data blob
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX idx_rx_tenant ON prescriptions(tenant_id);
CREATE INDEX idx_rx_patient ON prescriptions(patient_id);
CREATE INDEX idx_rx_admission ON prescriptions(admission_id);

-- 5.3 Medication Dispense Events
CREATE TABLE IF NOT EXISTS medication_dispense_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    prescription_id UUID REFERENCES prescriptions(id),
    admission_id UUID REFERENCES admissions(id),
    product_id UUID NOT NULL,
    lot TEXT,
    expiry DATE,
    qty_dispensed INTEGER NOT NULL,
    dispensed_by TEXT,
    dispensed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dispense_tenant ON medication_dispense_events(tenant_id);
CREATE INDEX idx_dispense_rx ON medication_dispense_events(prescription_id);

-- 5.4 Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    patient_id UUID NOT NULL,
    service_id UUID REFERENCES services(id),
    date_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    doctor_name TEXT,
    status TEXT CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appt_tenant ON appointments(tenant_id);
CREATE INDEX idx_appt_date ON appointments(date_time);

-- 5.5 Actes (Procedures - Tenant-specific pricing)
CREATE TABLE IF NOT EXISTS actes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    code TEXT NOT NULL,
    designation TEXT NOT NULL,
    category TEXT,
    price NUMERIC(12,4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. PRODUCT CATALOG CONFIGURATION
-- ============================================================================

-- 6.1 Product Configs (Tenant-specific product settings)
CREATE TABLE IF NOT EXISTS product_configs (
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,  -- References global_products
    is_enabled BOOLEAN DEFAULT TRUE,
    min_stock INTEGER,
    max_stock INTEGER,
    security_stock INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, product_id)
);

-- 6.2 Product Suppliers (Tenant-product-supplier links)
CREATE TABLE IF NOT EXISTS product_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL,
    supplier_id TEXT NOT NULL,
    supplier_type TEXT DEFAULT 'GLOBAL' CHECK (supplier_type IN ('GLOBAL', 'LOCAL')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, product_id, supplier_id)
);

CREATE INDEX idx_ps_tenant ON product_suppliers(tenant_id);
CREATE INDEX idx_ps_product ON product_suppliers(product_id);

-- 6.3 Product Price Versions (Price history per supplier link)
CREATE TABLE IF NOT EXISTS product_price_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    product_supplier_id UUID NOT NULL REFERENCES product_suppliers(id) ON DELETE CASCADE,
    purchase_price NUMERIC(12,4) NOT NULL,
    margin NUMERIC(12,4) DEFAULT 0,
    vat NUMERIC(5,2) DEFAULT 0,
    sale_price_ht NUMERIC(12,4),
    sale_price_ttc NUMERIC(12,4),
    unit_sale_price NUMERIC(12,4),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_to TIMESTAMPTZ,  -- NULL = currently active
    created_by TEXT,
    change_reason TEXT
);

CREATE INDEX idx_price_ver_supp ON product_price_versions(product_supplier_id);
CREATE INDEX idx_price_ver_active ON product_price_versions(product_supplier_id) WHERE valid_to IS NULL;

-- ============================================================================
-- 7. MIGRATION SUPPORT
-- ============================================================================

-- Migration issues quarantine table
CREATE TABLE IF NOT EXISTS _migration_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table TEXT NOT NULL,
    source_id TEXT,
    issue_type TEXT NOT NULL,
    issue_description TEXT,
    row_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
