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

  supplier_id TEXT,         -- used for deliveries/returns
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
  supplier_id TEXT,
  location TEXT NOT NULL,
  qty_units INTEGER NOT NULL,

  PRIMARY KEY (tenant_id, product_id, lot, location)
);

CREATE INDEX IF NOT EXISTS idx_stock_loc ON current_stock(tenant_id, location);
CREATE INDEX IF NOT EXISTS idx_stock_prod ON current_stock(tenant_id, product_id);

-- 1.3 Receipts + provenance layers
CREATE TABLE IF NOT EXISTS purchase_receipts (
  receipt_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  received_at DATETIME NOT NULL,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipt_layers (
  receipt_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  lot TEXT NOT NULL,
  expiry DATE NOT NULL,

  qty_received INTEGER NOT NULL,
  qty_remaining INTEGER NOT NULL,
  purchase_unit_cost NUMERIC(12,4),

  PRIMARY KEY (receipt_id, product_id, lot),
  FOREIGN KEY (receipt_id) REFERENCES purchase_receipts(receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_layers_prod_lot ON receipt_layers(tenant_id, product_id, lot, expiry);

-- 1.4 Supplier returns documents
CREATE TABLE IF NOT EXISTS supplier_returns (
  return_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_return_lines (
  return_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  lot TEXT NOT NULL,
  expiry DATE NOT NULL,
  qty_units INTEGER NOT NULL,

  PRIMARY KEY (return_id, product_id, lot),
  FOREIGN KEY (return_id) REFERENCES supplier_returns(return_id)
);

-- 1.5 Admissions sink
CREATE TABLE IF NOT EXISTS medication_dispense_events (
  dispense_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,

  admission_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,

  product_id TEXT NOT NULL,
  lot TEXT NOT NULL,
  expiry DATE NOT NULL,
  qty_units INTEGER NOT NULL,

  source_location TEXT NOT NULL,
  prescription_id TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Metadata Tables (Locations & Suppliers)
CREATE TABLE IF NOT EXISTS locations (
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- PHARMACY, WARD, ...
  scope TEXT NOT NULL, -- PHARMACY, SERVICE (Legacy compat)
  service_id TEXT, -- Nullable
  PRIMARY KEY (tenant_id, location_id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  tenant_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  PRIMARY KEY (tenant_id, supplier_id)
);

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
    product_id TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT 1,
    min_stock INTEGER,
    max_stock INTEGER,
    sales_price REAL, -- Cached/Overridden sales price
    active_price_version_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_suppliers (
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    purchase_price REAL,
    is_preferred BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, product_id, supplier_id)
);
