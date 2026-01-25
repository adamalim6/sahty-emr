-- 1.1 Master movement log
CREATE TABLE IF NOT EXISTS inventory_movements (
  movement_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,

  product_id TEXT NOT NULL,
  lot TEXT NOT NULL,
  expiry DATE NOT NULL,

  qty_units INTEGER NOT NULL,       -- negative = out, positive = in

  from_location TEXT,       -- nullable for receipts
  to_location TEXT,         -- nullable for consumption

  document_type TEXT NOT NULL, -- DELIVERY, REPLENISHMENT, DISPENSE, RETURN_SUPPLIER, RETURN_WARD, WASTE, DESTRUCTION, BORROW_IN, BORROW_OUT
  document_id TEXT,         -- BL_01, RET_..., REQ_..., PRESC_...

  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mov_tenant ON inventory_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mov_prod_lot_exp ON inventory_movements(tenant_id, product_id, lot, expiry);
CREATE INDEX IF NOT EXISTS idx_mov_doc ON inventory_movements(tenant_id, document_type, document_id);

-- 1.2 Current stock snapshot
CREATE TABLE IF NOT EXISTS current_stock (
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  lot TEXT NOT NULL,
  expiry DATE NOT NULL,
  location TEXT NOT NULL,
  qty_units INTEGER NOT NULL,

  PRIMARY KEY (tenant_id, product_id, lot, location)
);

CREATE INDEX IF NOT EXISTS idx_stock_loc ON current_stock(tenant_id, location);
CREATE INDEX IF NOT EXISTS idx_stock_prod ON current_stock(tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_stock_prod ON current_stock(tenant_id, product_id);

-- WAC / CMUP Table
CREATE TABLE IF NOT EXISTS product_wac (
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  wac NUMERIC(12,4) NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, product_id)
);

-- 1.3 Receipts + provenance layers
CREATE TABLE IF NOT EXISTS delivery_notes (
  delivery_note_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  po_id TEXT, -- Link to Purchase Order
  received_at DATETIME NOT NULL,
  status TEXT DEFAULT 'PENDING',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  delivery_note_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty_pending INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(delivery_note_id)
);

CREATE TABLE IF NOT EXISTS delivery_note_layers (
  delivery_note_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  lot TEXT NOT NULL,
  expiry DATE NOT NULL,

  qty_received INTEGER NOT NULL,
  qty_remaining INTEGER NOT NULL,
  purchase_unit_cost NUMERIC(12,4),

  PRIMARY KEY (delivery_note_id, product_id, lot),
  FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(delivery_note_id)
);

-- ...

-- 3. Purchasing & Replenishment Tables (Added for SQL Write Workflow)

-- 3.1 Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  po_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  status TEXT NOT NULL, -- DRAFT, ORDERED, RECEIVED, CANCELLED
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS po_items (
  po_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty_ordered INTEGER NOT NULL,
  qty_delivered INTEGER DEFAULT 0,
  qty_to_be_delivered INTEGER DEFAULT 0,
  unit_price NUMERIC(12,4),
  
  PRIMARY KEY (po_id, product_id),
  FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id)
);

CREATE INDEX IF NOT EXISTS idx_po_tenant ON purchase_orders(tenant_id);

-- 3.2 Replenishment Requests (Service -> Pharmacy)
CREATE TABLE IF NOT EXISTS replenishment_requests (
  request_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  status TEXT NOT NULL, -- PENDING, APPROVED, DISPENSED, REJECTED
  requested_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS replenishment_items (
  request_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty_requested INTEGER NOT NULL,
  qty_dispensed INTEGER DEFAULT 0,
  
  PRIMARY KEY (request_id, product_id),
  FOREIGN KEY (request_id) REFERENCES replenishment_requests(request_id)
);

CREATE INDEX IF NOT EXISTS idx_replenishment_tenant ON replenishment_requests(tenant_id);

-- 4. Settings Domain
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT,
  nom TEXT,
  prenom TEXT,
  user_type TEXT,
  role_id TEXT,
  inpe TEXT,
  service_ids TEXT, -- JSON array
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, -- role_...
  name TEXT NOT NULL,
  code TEXT,
  permissions TEXT, -- JSON array
  modules TEXT -- JSON array
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS service_units (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  capacity INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  service_id TEXT,
  number TEXT NOT NULL,
  section TEXT,
  is_occupied BOOLEAN DEFAULT 0,
  type TEXT
);

-- 5. EMR Domain
CREATE TABLE IF NOT EXISTS admissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  patient_id TEXT NOT NULL, -- Global Patient Ref
  nda TEXT,
  reason TEXT,
  service_id TEXT,
  admission_date DATETIME NOT NULL,
  discharge_date DATETIME,
  doctor_name TEXT,
  room_number TEXT,
  bed_label TEXT,
  status TEXT,
  currency TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  data TEXT, -- JSON Blob of PrescriptionData
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  service_id TEXT,
  date_time DATETIME NOT NULL,
  reason TEXT,
  doctor_name TEXT,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS actes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  designation TEXT NOT NULL,
  category TEXT,
  price REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Product Catalog Configuration
CREATE TABLE IF NOT EXISTS product_configs (
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL, -- Global Product ID
    is_enabled BOOLEAN DEFAULT 1,
    min_stock INTEGER,
    max_stock INTEGER,
    security_stock INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_suppliers (
    id TEXT PRIMARY KEY, -- config_...
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    supplier_type TEXT DEFAULT 'GLOBAL', -- 'GLOBAL' | 'LOCAL'
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS product_price_versions (
    id TEXT PRIMARY KEY, -- ver_...
    tenant_id TEXT NOT NULL,
    product_supplier_id TEXT NOT NULL, -- FK to product_suppliers.id
    
    purchase_price NUMERIC(12,4) NOT NULL,
    margin NUMERIC(12,4) DEFAULT 0,
    vat NUMERIC(5,2) DEFAULT 0,
    sale_price_ht NUMERIC(12,4),
    sale_price_ttc NUMERIC(12,4),
    unit_sale_price NUMERIC(12,4), -- New Column
    
    valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_to DATETIME, -- Null = Active
    created_by TEXT,
    
    FOREIGN KEY (product_supplier_id) REFERENCES product_suppliers(id)
);
CREATE INDEX IF NOT EXISTS idx_price_ver_supp ON product_price_versions(product_supplier_id);

-- 7. Locations (Pharmacy)
CREATE TABLE IF NOT EXISTS locations (
    tenant_id TEXT NOT NULL,
    location_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    scope TEXT, -- 'PHARMACY' | 'SERVICE'
    service_id TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loc_tenant ON locations(tenant_id);


-- 8. Stock Reservations (Hold Engine)
CREATE TABLE IF NOT EXISTS stock_reservations (
    reservation_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    demand_id TEXT,
    demand_line_id TEXT,
    product_id TEXT NOT NULL,
    lot TEXT,
    expiry DATE,
    location_id TEXT NOT NULL,
    qty_units INTEGER NOT NULL CHECK(qty_units > 0),
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, RELEASED, COMMITTED, EXPIRED
    reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    released_at DATETIME,
    committed_at DATETIME,
    transfer_id TEXT,
    transfer_line_id TEXT,
    client_request_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_res_active ON stock_reservations(tenant_id, location_id, product_id, lot, expiry) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_res_session ON stock_reservations(tenant_id, session_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_res_expires ON stock_reservations(status, expires_at) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS idx_res_idempotency ON stock_reservations(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;
