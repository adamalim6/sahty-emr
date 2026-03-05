-- ============================================================================
-- BASELINE TENANT SCHEMA
-- ============================================================================
-- Single-file schema for new tenant databases.
-- Replaces all incremental migrations (000–028).
-- Generated from reference tenant HCK (36dff8fa-4729-4c10-a0bf-712be63cc9b2)
-- Date: 2026-02-10
-- ============================================================================

-- ============================================================================
-- 1. SCHEMA CREATION
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS identity_sync;
CREATE SCHEMA IF NOT EXISTS reference;

-- ============================================================================
-- 2. AUTH SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth.users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    inpe          TEXT NULL UNIQUE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    master_patient_id UUID NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.credentials (
    credential_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    password_hash       TEXT NOT NULL,
    password_algo       TEXT NOT NULL DEFAULT 'bcrypt',
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS auth.user_tenants (
    user_id    UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS auth.audit_log (
    audit_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id  UUID NULL,
    action         TEXT NOT NULL,
    target_user_id UUID NULL,
    metadata       JSONB NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. IDENTITY SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS identity.master_patients (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    dob               DATE,
    sex               TEXT,
    status            TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS identity.master_patient_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_patient_id   UUID NOT NULL REFERENCES identity.master_patients(id) ON DELETE CASCADE,
    document_type_code  TEXT NOT NULL,
    document_number     TEXT NOT NULL,
    issuing_country_code TEXT,
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_master_patient_id ON identity.master_patient_documents (master_patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_lookup ON identity.master_patient_documents (document_type_code, document_number);

CREATE TABLE IF NOT EXISTS identity.master_patient_aliases (
    alias_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id) ON DELETE CASCADE,
    alias_first_name  TEXT,
    alias_last_name   TEXT,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS identity.master_patient_merge_events (
    merge_event_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survivor_id     UUID NOT NULL REFERENCES identity.master_patients(id),
    retired_id      UUID NOT NULL REFERENCES identity.master_patients(id),
    merged_by       UUID,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. IDENTITY SYNC SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS identity_sync.outbox_events (
    event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id   UUID NOT NULL,
    operation   TEXT NOT NULL,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS identity_sync.inbox_events (
    event_id        UUID PRIMARY KEY,
    source_tenant_id UUID,
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    operation       TEXT NOT NULL,
    payload         JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS identity_sync.sync_state (
    id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_central_outbox_seq BIGINT NOT NULL DEFAULT 0,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Identity sync triggers (outbox auto-population on identity table changes)
CREATE OR REPLACE FUNCTION identity_sync.fn_push_outbox()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO identity_sync.outbox_events (entity_type, entity_id, operation, payload)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, NEW.master_patient_id, NEW.alias_id, NEW.merge_event_id, OLD.id, OLD.master_patient_id, OLD.alias_id, OLD.merge_event_id),
        TG_OP,
        CASE TG_OP
            WHEN 'DELETE' THEN row_to_json(OLD)::jsonb
            ELSE row_to_json(NEW)::jsonb
        END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- master_patients
CREATE OR REPLACE TRIGGER trg_sync_master_patients_insert
    AFTER INSERT ON identity.master_patients FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();
CREATE OR REPLACE TRIGGER trg_sync_master_patients_update
    AFTER UPDATE ON identity.master_patients FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();
CREATE OR REPLACE TRIGGER trg_sync_master_patients_delete
    AFTER DELETE ON identity.master_patients FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();

-- master_patient_documents
CREATE OR REPLACE TRIGGER trg_sync_master_patient_documents_insert
    AFTER INSERT ON identity.master_patient_documents FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();
CREATE OR REPLACE TRIGGER trg_sync_master_patient_documents_update
    AFTER UPDATE ON identity.master_patient_documents FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();
CREATE OR REPLACE TRIGGER trg_sync_master_patient_documents_delete
    AFTER DELETE ON identity.master_patient_documents FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();

-- master_patient_aliases
CREATE OR REPLACE TRIGGER trg_sync_master_patient_aliases_insert
    AFTER INSERT ON identity.master_patient_aliases FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();
CREATE OR REPLACE TRIGGER trg_sync_master_patient_aliases_update
    AFTER UPDATE ON identity.master_patient_aliases FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();
CREATE OR REPLACE TRIGGER trg_sync_master_patient_aliases_delete
    AFTER DELETE ON identity.master_patient_aliases FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();

-- master_patient_merge_events
CREATE OR REPLACE TRIGGER trg_sync_master_patient_merge_events_insert
    AFTER INSERT ON identity.master_patient_merge_events FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();
CREATE OR REPLACE TRIGGER trg_sync_master_patient_merge_events_update
    AFTER UPDATE ON identity.master_patient_merge_events FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();
CREATE OR REPLACE TRIGGER trg_sync_master_patient_merge_events_delete
    AFTER DELETE ON identity.master_patient_merge_events FOR EACH ROW EXECUTE FUNCTION identity_sync.fn_push_outbox();

-- ============================================================================
-- 5. REFERENCE SCHEMA (empty shell — tables populated by referenceSync)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reference.care_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_categories_active_order ON reference.care_categories (is_active, sort_order);

CREATE TABLE IF NOT EXISTS reference.countries (
    country_id UUID PRIMARY KEY,
    iso_code   TEXT,
    name       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.sih_familles (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    libelle text not null,
    actif boolean not null default true,
    created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS reference.sih_sous_familles (
    id uuid primary key default gen_random_uuid(),
    famille_id uuid not null references reference.sih_familles(id) on delete restrict,
    code text not null,
    libelle text not null,
    actif boolean not null default true,
    created_at timestamptz not null default now(),
    unique (famille_id, code)
);

CREATE TABLE IF NOT EXISTS reference.global_actes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_sih       TEXT NOT NULL UNIQUE,
    libelle_sih    TEXT NOT NULL,
    famille_id     UUID REFERENCES reference.sih_familles(id) on delete set null,
    sous_famille_id UUID REFERENCES reference.sih_sous_familles(id) on delete set null,
    code_ngap      TEXT,
    libelle_ngap   TEXT,
    cotation_ngap  TEXT,
    code_ccam      TEXT,
    libelle_ccam   TEXT,
    type_acte      TEXT,
    duree_moyenne  INTEGER,
    actif          BOOLEAN DEFAULT TRUE,
    catalog_version INTEGER NOT NULL DEFAULT 1,
    bio_grise BOOLEAN,
    bio_grise_prescription BOOLEAN,
    bio_delai_resultats_heures INTEGER,
    bio_cle_facturation TEXT,
    bio_nombre_b INTEGER,
    bio_nombre_b1 INTEGER,
    bio_nombre_b2 INTEGER,
    bio_nombre_b3 INTEGER,
    bio_nombre_b4 INTEGER,
    bio_instructions_prelevement TEXT,
    bio_commentaire TEXT,
    bio_commentaire_prescription TEXT,
    default_specimen_type TEXT,
    is_lims_enabled BOOLEAN DEFAULT FALSE,
    lims_template_code TEXT
);

CREATE TABLE IF NOT EXISTS reference.global_atc (
    code     TEXT PRIMARY KEY,
    label_fr TEXT,
    label_en TEXT,
    level    INTEGER,
    parent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_ref_atc_level ON reference.global_atc (level);
CREATE INDEX IF NOT EXISTS idx_ref_atc_parent ON reference.global_atc (parent);

CREATE TABLE IF NOT EXISTS reference.global_dci (
    id                UUID PRIMARY KEY,
    name              TEXT NOT NULL,
    atc_code          TEXT,
    therapeutic_class TEXT,
    care_category_id  UUID REFERENCES reference.care_categories(id),
    created_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ref_dci_name ON reference.global_dci (name);
CREATE INDEX IF NOT EXISTS idx_ref_dci_atc ON reference.global_dci (atc_code) WHERE atc_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS reference.dci_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dci_id UUID NOT NULL REFERENCES reference.global_dci(id) ON DELETE CASCADE,
    synonym TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ref_dci_synonyms_dci_id ON reference.dci_synonyms(dci_id);

CREATE TABLE IF NOT EXISTS reference.global_emdn (
    code     TEXT PRIMARY KEY,
    label_fr TEXT,
    label_en TEXT,
    level    INTEGER,
    parent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_ref_emdn_parent ON reference.global_emdn (parent);

CREATE TABLE IF NOT EXISTS reference.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    display TEXT NOT NULL,
    is_ucum BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_units_active_order ON reference.units (is_active, sort_order);

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

CREATE TABLE IF NOT EXISTS reference.global_products (
    id                  UUID PRIMARY KEY,
    type                TEXT NOT NULL,
    name                TEXT NOT NULL,
    form                TEXT,
    dci_composition     JSONB,
    presentation        TEXT,
    manufacturer        TEXT,
    ppv                 NUMERIC,
    ph                  NUMERIC,
    pfht                NUMERIC,
    class_therapeutique TEXT,
    sahty_code          TEXT,
    code                TEXT,
    units_per_pack      INTEGER DEFAULT 1,
    default_presc_unit  UUID REFERENCES reference.units(id),
    default_presc_route UUID REFERENCES reference.routes(id),
    care_category_id    UUID REFERENCES reference.care_categories(id),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ref_products_name ON reference.global_products (name);
CREATE INDEX IF NOT EXISTS idx_ref_products_sahty ON reference.global_products (sahty_code) WHERE sahty_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ref_products_active ON reference.global_products (is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS reference.global_product_price_history (
    id         UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES reference.global_products(id) ON DELETE CASCADE,
    ppv        NUMERIC,
    ph         NUMERIC,
    pfht       NUMERIC,
    valid_from TIMESTAMPTZ,
    valid_to   TIMESTAMPTZ,
    created_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ref_price_hist_product ON reference.global_product_price_history (product_id);
CREATE INDEX IF NOT EXISTS idx_ref_price_hist_dates ON reference.global_product_price_history (valid_from, valid_to);

CREATE TABLE IF NOT EXISTS reference.global_roles (
    id           UUID PRIMARY KEY,
    code         TEXT,
    name         TEXT NOT NULL,
    description  TEXT,
    permissions  JSONB,
    modules      JSONB,
    assignable_by TEXT,
    created_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reference.global_suppliers (
    id           UUID PRIMARY KEY,
    name         TEXT NOT NULL,
    tax_id       TEXT,
    address      TEXT,
    contact_info JSONB,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ref_suppliers_active ON reference.global_suppliers (is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS reference.identity_document_types (
    code             TEXT PRIMARY KEY,
    label            TEXT NOT NULL,
    validation_regex TEXT,
    created_at       TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reference.organismes (
    id          UUID PRIMARY KEY,
    designation TEXT NOT NULL,
    category    TEXT NOT NULL,
    sub_type    TEXT,
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ
);

-- ============================================================================
-- 6. PUBLIC SCHEMA — SETTINGS DOMAIN
-- ============================================================================

-- 6.1 Services
CREATE TABLE IF NOT EXISTS services (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    code        TEXT,
    description TEXT
);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services (tenant_id);

-- 6.2 Service Units
CREATE TABLE IF NOT EXISTS service_units (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    type       TEXT,
    capacity   INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_su_service ON service_units (service_id);

-- 6.3 Room Types
CREATE TABLE IF NOT EXISTS room_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    unit_category   TEXT NOT NULL DEFAULT 'CHAMBRE',
    number_of_beds  INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6.4 Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id),
    room_type_id    UUID NOT NULL REFERENCES room_types(id),
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rooms_service ON rooms (service_id);

-- 6.5 Beds
DO $$ BEGIN
    CREATE TYPE bed_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS beds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID NOT NULL REFERENCES rooms(id),
    label       TEXT NOT NULL,
    status      bed_status NOT NULL DEFAULT 'AVAILABLE',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(room_id, label)
);
CREATE INDEX IF NOT EXISTS idx_beds_room ON beds (room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds (status) WHERE status = 'AVAILABLE';

-- 6.4 User Roles (links auth.users → reference.global_roles)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id     UUID NOT NULL,
    role_id     UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);

-- 6.5 User Services (links auth.users → services)
CREATE TABLE IF NOT EXISTS user_services (
    user_id    UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, service_id)
);
CREATE INDEX IF NOT EXISTS idx_user_services_user_id ON user_services (user_id);
CREATE INDEX IF NOT EXISTS idx_user_services_service_id ON user_services (service_id);

-- ============================================================================
-- 7. PUBLIC SCHEMA — LOCATION MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS locations (
    location_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    name             TEXT NOT NULL,
    type             TEXT,
    scope            TEXT,
    service_id       UUID,
    status           TEXT DEFAULT 'ACTIVE',
    created_at       TIMESTAMPTZ DEFAULT now(),
    location_class   TEXT DEFAULT 'COMMERCIAL',
    valuation_policy TEXT NOT NULL DEFAULT 'VALUABLE'
);
CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations (tenant_id);

-- Prevent deactivation of system locations
CREATE OR REPLACE FUNCTION fn_prevent_system_location_deactivate()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.scope = 'SYSTEM' AND NEW.status = 'INACTIVE' THEN
        RAISE EXCEPTION 'Cannot deactivate system location %', OLD.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_prevent_system_location_deactivate
    BEFORE UPDATE ON locations FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_system_location_deactivate();

-- ============================================================================
-- 8. PUBLIC SCHEMA — SUPPLIER MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    address     TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 9. PUBLIC SCHEMA — INVENTORY DOMAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    movement_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    product_id       UUID NOT NULL,
    lot              TEXT NOT NULL,
    expiry           DATE NOT NULL,
    qty_units        INTEGER NOT NULL,
    from_location_id UUID,
    to_location_id   UUID,
    document_type    TEXT NOT NULL,
    document_id      UUID,
    created_by       UUID,
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_tenant ON inventory_movements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_product ON inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_inv_doc ON inventory_movements (document_type, document_id);

CREATE TABLE IF NOT EXISTS current_stock (
    tenant_id            UUID NOT NULL,
    product_id           UUID NOT NULL,
    lot                  TEXT NOT NULL,
    expiry               DATE NOT NULL,
    location_id          UUID NOT NULL,
    qty_units            INTEGER NOT NULL,
    reserved_units       INTEGER NOT NULL DEFAULT 0,
    pending_return_units INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stock_lookup ON current_stock (tenant_id, product_id, lot, expiry, location_id);

CREATE TABLE IF NOT EXISTS product_wac (
    tenant_id    UUID NOT NULL,
    product_id   UUID NOT NULL,
    wac          NUMERIC NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (tenant_id, product_id)
);

-- ============================================================================
-- 10. PUBLIC SCHEMA — STOCK RESERVATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_reservations (
    reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    session_id     UUID NOT NULL,
    user_id        UUID NOT NULL,
    stock_demand_id UUID,
    status         TEXT DEFAULT 'ACTIVE',
    reserved_at    TIMESTAMPTZ DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    released_at    TIMESTAMPTZ,
    committed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_res_session ON stock_reservations (tenant_id, session_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_res_session_active ON stock_reservations (tenant_id, session_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_res_expires ON stock_reservations (status, expires_at) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_res_cleanup ON stock_reservations (expires_at) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS stock_reservation_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id          UUID NOT NULL REFERENCES stock_reservations(reservation_id),
    tenant_id               UUID NOT NULL,
    stock_demand_line_id    UUID,
    product_id              UUID NOT NULL,
    lot                     TEXT NOT NULL,
    expiry                  DATE NOT NULL,
    source_location_id      UUID NOT NULL,
    destination_location_id UUID,
    qty_units               INTEGER NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resline_reservation ON stock_reservation_lines (reservation_id);
CREATE INDEX IF NOT EXISTS idx_resline_tenant ON stock_reservation_lines (tenant_id);
CREATE INDEX IF NOT EXISTS idx_resline_lookup ON stock_reservation_lines (product_id, lot, expiry, source_location_id);

-- ============================================================================
-- 11. PUBLIC SCHEMA — DELIVERY & PURCHASE ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_notes (
    delivery_note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    supplier_id      TEXT NOT NULL,
    po_id            UUID,
    received_at      TIMESTAMPTZ NOT NULL,
    status           TEXT DEFAULT 'PENDING',
    created_by       TEXT,
    created_at       TIMESTAMPTZ DEFAULT now(),
    reference        TEXT
);
CREATE INDEX IF NOT EXISTS idx_dn_tenant ON delivery_notes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dn_supplier ON delivery_notes (supplier_id);

CREATE TABLE IF NOT EXISTS delivery_note_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    delivery_note_id UUID NOT NULL,
    product_id       UUID NOT NULL,
    qty_pending      INTEGER NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dni_dn ON delivery_note_items (delivery_note_id);

CREATE TABLE IF NOT EXISTS delivery_note_layers (
    delivery_note_id  UUID NOT NULL,
    tenant_id         UUID NOT NULL,
    product_id        UUID NOT NULL,
    lot               TEXT NOT NULL,
    expiry            DATE NOT NULL,
    qty_received      INTEGER NOT NULL,
    qty_remaining     INTEGER NOT NULL,
    purchase_unit_cost NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_dnl_dn ON delivery_note_layers (delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_dnl_product ON delivery_note_layers (product_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    supplier_id UUID NOT NULL,
    status      TEXT NOT NULL,
    created_by  UUID,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    reference   TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_tenant ON purchase_orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders (status);

CREATE TABLE IF NOT EXISTS po_items (
    po_id               UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL,
    product_id          UUID NOT NULL,
    qty_ordered         INTEGER NOT NULL,
    qty_delivered       INTEGER DEFAULT 0,
    qty_to_be_delivered INTEGER DEFAULT 0,
    unit_price          NUMERIC,
    PRIMARY KEY (po_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_poi_po ON po_items (po_id);

-- ============================================================================
-- 12. PUBLIC SCHEMA — PRODUCT CONFIG
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_configs (
    tenant_id      UUID NOT NULL,
    product_id     UUID NOT NULL,
    is_enabled     BOOLEAN DEFAULT TRUE,
    min_stock      INTEGER,
    max_stock      INTEGER,
    security_stock INTEGER,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (tenant_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_config_enabled ON product_configs (tenant_id, is_enabled) WHERE is_enabled = TRUE;

CREATE TABLE IF NOT EXISTS product_suppliers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    product_id    UUID NOT NULL,
    supplier_id   UUID NOT NULL,
    supplier_type TEXT DEFAULT 'GLOBAL',
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, product_id, supplier_id)
);
CREATE INDEX IF NOT EXISTS idx_ps_tenant ON product_suppliers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ps_product ON product_suppliers (product_id);

CREATE TABLE IF NOT EXISTS product_price_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    product_supplier_id UUID NOT NULL REFERENCES product_suppliers(id) ON DELETE CASCADE,
    purchase_price      NUMERIC NOT NULL,
    margin              NUMERIC DEFAULT 0,
    vat                 NUMERIC DEFAULT 0,
    sale_price_ht       NUMERIC,
    sale_price_ttc      NUMERIC,
    unit_sale_price     NUMERIC,
    valid_from          TIMESTAMPTZ DEFAULT now(),
    valid_to            TIMESTAMPTZ,
    created_by          TEXT,
    change_reason       TEXT,
    status              TEXT DEFAULT 'ACTIVE'
);
CREATE INDEX IF NOT EXISTS idx_price_ver_supp ON product_price_versions (product_supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_ver_active ON product_price_versions (product_supplier_id) WHERE valid_to IS NULL;

-- ============================================================================
-- 13. PUBLIC SCHEMA — STOCK DEMANDS & TRANSFERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_demands (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    service_id   UUID NOT NULL,
    status       TEXT NOT NULL DEFAULT 'DRAFT',
    priority     TEXT DEFAULT 'ROUTINE',
    requested_by UUID,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    demand_ref   TEXT
);
CREATE INDEX IF NOT EXISTS idx_demand_tenant ON stock_demands (tenant_id);
CREATE INDEX IF NOT EXISTS idx_demand_service ON stock_demands (service_id);
CREATE INDEX IF NOT EXISTS idx_demand_status ON stock_demands (status);
CREATE INDEX IF NOT EXISTS idx_demand_ref ON stock_demands (demand_ref);

CREATE TABLE IF NOT EXISTS stock_demand_lines (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id                 UUID NOT NULL REFERENCES stock_demands(id) ON DELETE CASCADE,
    tenant_id                 UUID NOT NULL,
    product_id                UUID NOT NULL,
    qty_requested             INTEGER NOT NULL,
    qty_allocated             INTEGER DEFAULT 0,
    qty_transferred           INTEGER DEFAULT 0,
    created_at                TIMESTAMPTZ DEFAULT now(),
    target_stock_location_id  UUID
);
CREATE INDEX IF NOT EXISTS idx_demand_line_demand ON stock_demand_lines (demand_id);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    demand_id           UUID REFERENCES stock_demands(id),
    status              TEXT NOT NULL DEFAULT 'PENDING',
    validated_at        TIMESTAMPTZ,
    validated_by        TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    client_request_id   TEXT,
    stock_reservation_id UUID
);
CREATE INDEX IF NOT EXISTS idx_transfer_tenant ON stock_transfers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfer_demand ON stock_transfers (demand_id);
CREATE INDEX IF NOT EXISTS idx_transfer_idempotency ON stock_transfers (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stock_transfer_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id             UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL,
    product_id              UUID NOT NULL,
    lot                     TEXT NOT NULL,
    expiry                  DATE NOT NULL,
    qty_transferred         INTEGER NOT NULL,
    demand_line_id          UUID REFERENCES stock_demand_lines(id),
    created_at              TIMESTAMPTZ DEFAULT now(),
    source_location_id      UUID,
    destination_location_id UUID,
    reservation_line_id     UUID
);
CREATE INDEX IF NOT EXISTS idx_transfer_line_transfer ON stock_transfer_lines (transfer_id);

-- ============================================================================
-- 14. PUBLIC SCHEMA — RETURNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_returns (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    source_type          TEXT NOT NULL,
    source_service_id    UUID,
    created_by           UUID NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    status               TEXT NOT NULL DEFAULT 'DRAFT',
    stock_reservation_id UUID REFERENCES stock_reservations(reservation_id),
    return_reference     TEXT
);
CREATE INDEX IF NOT EXISTS idx_returns_tenant ON stock_returns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON stock_returns (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_returns_service ON stock_returns (source_service_id);
CREATE INDEX IF NOT EXISTS idx_stock_returns_reference ON stock_returns (return_reference);

CREATE TABLE IF NOT EXISTS stock_return_lines (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id                  UUID NOT NULL REFERENCES stock_returns(id) ON DELETE CASCADE,
    product_id                 UUID NOT NULL,
    lot                        TEXT NOT NULL,
    expiry                     DATE NOT NULL,
    source_location_id         UUID NOT NULL,
    qty_declared_units         INTEGER NOT NULL,
    original_dispense_event_id UUID,
    stock_reservation_line_id  UUID REFERENCES stock_reservation_lines(id)
);
CREATE INDEX IF NOT EXISTS idx_return_lines_return ON stock_return_lines (return_id);
CREATE INDEX IF NOT EXISTS idx_return_lines_product ON stock_return_lines (product_id);

CREATE TABLE IF NOT EXISTS return_receptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id           UUID NOT NULL REFERENCES stock_returns(id) ON DELETE CASCADE,
    received_by         UUID NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    reception_reference TEXT,
    status              TEXT NOT NULL DEFAULT 'OPEN'
);
CREATE INDEX IF NOT EXISTS idx_receptions_return ON return_receptions (return_id);
CREATE INDEX IF NOT EXISTS idx_return_receptions_reference ON return_receptions (reception_reference);

CREATE TABLE IF NOT EXISTS return_reception_lines (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reception_id       UUID NOT NULL REFERENCES return_receptions(id) ON DELETE CASCADE,
    return_line_id     UUID NOT NULL REFERENCES stock_return_lines(id),
    qty_received_units INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reception_lines_reception ON return_reception_lines (reception_id);
CREATE INDEX IF NOT EXISTS idx_reception_lines_return_line ON return_reception_lines (return_line_id);

CREATE TABLE IF NOT EXISTS return_decisions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reception_id UUID NOT NULL REFERENCES return_receptions(id) ON DELETE CASCADE,
    decided_by   UUID NOT NULL,
    decided_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decisions_reception ON return_decisions (reception_id);

CREATE TABLE IF NOT EXISTS return_decision_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id             UUID NOT NULL REFERENCES return_decisions(id) ON DELETE CASCADE,
    return_line_id          UUID NOT NULL REFERENCES stock_return_lines(id),
    qty_units               INTEGER NOT NULL,
    outcome                 TEXT NOT NULL,
    destination_location_id UUID REFERENCES locations(location_id)
);
CREATE INDEX IF NOT EXISTS idx_decision_lines_decision ON return_decision_lines (decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_lines_return_line ON return_decision_lines (return_line_id);

-- ============================================================================
-- 15. PUBLIC SCHEMA — EMR DOMAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS patients_tenant (
    tenant_patient_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                      UUID NOT NULL,
    medical_record_number          TEXT,
    lifecycle_status               TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (lifecycle_status IN ('ACTIVE', 'MERGED', 'INACTIVE')),
    identity_status                TEXT NOT NULL DEFAULT 'PROVISIONAL'
        CHECK (identity_status IN ('UNKNOWN', 'PROVISIONAL', 'VERIFIED')),
    created_at                     TIMESTAMPTZ DEFAULT now(),
    master_patient_id              UUID REFERENCES identity.master_patients(id),
    mpi_link_status                TEXT NOT NULL DEFAULT 'UNLINKED',
    first_name                     TEXT,
    last_name                      TEXT,
    dob                            DATE,
    sex                            TEXT,
    merged_into_tenant_patient_id  UUID REFERENCES patients_tenant(tenant_patient_id),
    UNIQUE (tenant_id, medical_record_number)
);
CREATE INDEX IF NOT EXISTS idx_patients_tenant_tenant ON patients_tenant (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patients_tenant_mrn ON patients_tenant (tenant_id, medical_record_number);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_chart_per_master
    ON patients_tenant (tenant_id, master_patient_id)
    WHERE lifecycle_status = 'ACTIVE' AND master_patient_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS patient_contacts (
    contact_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_patient_id UUID NOT NULL,
    phone             TEXT,
    email             TEXT,
    created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patient_addresses (
    address_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_patient_id UUID NOT NULL,
    address_line      TEXT,
    city              TEXT,
    country_id        UUID,
    created_at        TIMESTAMPTZ DEFAULT now(),
    address_line2     TEXT,
    postal_code       TEXT,
    region            TEXT,
    country_code      TEXT,
    is_primary        BOOLEAN NOT NULL DEFAULT FALSE
);

-- 15.b Identity IDs (Migration 041) — Replaces patient_documents for new identity model
CREATE TABLE IF NOT EXISTS identity_ids (
    identity_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    tenant_patient_id    UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    identity_type_code   TEXT NOT NULL,
    identity_value       TEXT NOT NULL,
    issuing_country_code TEXT,
    is_primary           BOOLEAN NOT NULL DEFAULT FALSE,
    status               TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_identity_ids_patient ON identity_ids(tenant_id, tenant_patient_id);
CREATE INDEX IF NOT EXISTS idx_identity_ids_lookup ON identity_ids(tenant_id, identity_type_code, identity_value);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mrn_per_tenant ON identity_ids(tenant_id, identity_type_code, identity_value) WHERE identity_type_code = 'LOCAL_MRN' AND status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_nid_per_tenant ON identity_ids(tenant_id, identity_type_code, identity_value, issuing_country_code) WHERE identity_type_code IN ('NATIONAL_ID', 'PASSPORT', 'CIN') AND status = 'ACTIVE';

-- 15.c Patient Identity Change Log (Migration 041)
CREATE TABLE IF NOT EXISTS patient_identity_change (
    change_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    tenant_patient_id   UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by_user_id  UUID,
    change_source       TEXT NOT NULL,
    field_path          TEXT NOT NULL,
    old_value           TEXT,
    new_value           TEXT,
    reason              TEXT
);
CREATE INDEX IF NOT EXISTS idx_identity_change_patient ON patient_identity_change(tenant_id, tenant_patient_id);

-- 15.d Patient Relationship Links (Migration 041 + 045)
CREATE TABLE IF NOT EXISTS patient_relationship_links (
    relationship_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                    UUID NOT NULL,
    subject_tenant_patient_id    UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    related_tenant_patient_id    UUID REFERENCES patients_tenant(tenant_patient_id) ON DELETE SET NULL,
    related_first_name           TEXT,
    related_last_name            TEXT,
    related_identity_type_code   TEXT,
    related_identity_value       TEXT,
    related_issuing_country_code TEXT,
    related_phone                TEXT,
    relationship_type_code       TEXT NOT NULL,
    is_legal_guardian             BOOLEAN NOT NULL DEFAULT FALSE,
    is_decision_maker             BOOLEAN NOT NULL DEFAULT FALSE,
    is_emergency_contact          BOOLEAN NOT NULL DEFAULT FALSE,
    priority                     INTEGER,
    is_primary                   BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from                   DATE,
    valid_to                     DATE,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rel_links_subject ON patient_relationship_links(tenant_id, subject_tenant_patient_id);
CREATE INDEX IF NOT EXISTS idx_rel_links_related ON patient_relationship_links(tenant_id, related_tenant_patient_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_rel_patient ON patient_relationship_links(tenant_id, subject_tenant_patient_id, related_tenant_patient_id, relationship_type_code) WHERE related_tenant_patient_id IS NOT NULL;

-- 15.e Coverages & Members (Migration 041 + 046)
CREATE TABLE IF NOT EXISTS coverages (
    coverage_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    organisme_id       UUID NOT NULL REFERENCES reference.organismes(id),
    policy_number      TEXT NOT NULL,
    group_number       TEXT,
    plan_name          TEXT,
    coverage_type_code TEXT,
    effective_from     DATE,
    effective_to       DATE,
    status             TEXT NOT NULL DEFAULT 'ACTIVE',
    -- Subscriber denormalization (intentional redundancy with coverage_members SELF row)
    subscriber_tenant_patient_id UUID REFERENCES patients_tenant(tenant_patient_id),
    subscriber_first_name        TEXT,
    subscriber_last_name         TEXT,
    subscriber_identity_type     TEXT,
    subscriber_identity_value    TEXT,
    subscriber_issuing_country   TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coverages_lookup ON coverages(tenant_id, organisme_id, policy_number);

CREATE TABLE IF NOT EXISTS coverage_members (
    coverage_member_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                    UUID NOT NULL,
    coverage_id                  UUID NOT NULL REFERENCES coverages(coverage_id) ON DELETE CASCADE,
    tenant_patient_id            UUID REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE, -- Nullable (Mig 046)
    relationship_to_subscriber_code TEXT,

    -- External Subscriber Fields (Mig 046)
    member_first_name            TEXT,
    member_last_name             TEXT,
    member_identity_type         TEXT,
    member_identity_value        TEXT,
    member_issuing_country       TEXT,

    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Ensure uniqueness for patient members
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_coverage_member ON coverage_members(coverage_id, tenant_patient_id) WHERE tenant_patient_id IS NOT NULL;
-- Ensure max one 'SELF' subscriber per coverage
CREATE UNIQUE INDEX IF NOT EXISTS idx_coverage_subscriber_unique ON coverage_members(coverage_id) WHERE relationship_to_subscriber_code = 'SELF';


CREATE TABLE IF NOT EXISTS patient_tenant_merge_events (
    merge_event_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID NOT NULL,
    source_tenant_patient_id   UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    target_tenant_patient_id   UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    reason                     TEXT,
    merged_by_user_id          UUID,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merge_events_tenant ON patient_tenant_merge_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_merge_events_source ON patient_tenant_merge_events (source_tenant_patient_id);
CREATE INDEX IF NOT EXISTS idx_merge_events_target ON patient_tenant_merge_events (target_tenant_patient_id);

CREATE TABLE IF NOT EXISTS admissions (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                     UUID NOT NULL,
    tenant_patient_id             UUID REFERENCES patients_tenant(tenant_patient_id),
    admission_number              TEXT,
    reason                        TEXT,
    attending_physician_user_id   UUID REFERENCES auth.users(user_id),
    admitting_service_id          UUID REFERENCES services(id),
    responsible_service_id        UUID REFERENCES services(id),
    current_service_id            UUID REFERENCES services(id),
    admission_type                TEXT,
    arrival_mode                  TEXT,
    provenance                    TEXT,
    admission_date                TIMESTAMPTZ NOT NULL,
    discharge_date                TIMESTAMPTZ,
    status                        TEXT,
    currency                      TEXT DEFAULT 'MAD',
    created_at                    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admissions_tenant ON admissions (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_admission_number_tenant
    ON admissions (tenant_id, admission_number)
    WHERE admission_number IS NOT NULL;
CREATE SEQUENCE IF NOT EXISTS admission_number_seq START 1;

CREATE TABLE IF NOT EXISTS patient_stays (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id        UUID NOT NULL REFERENCES admissions(id),
    tenant_patient_id   UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    bed_id              UUID NOT NULL REFERENCES beds(id),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_stays_admission ON patient_stays (admission_id);
CREATE INDEX IF NOT EXISTS idx_patient_stays_bed ON patient_stays (bed_id);
CREATE INDEX IF NOT EXISTS idx_patient_stays_active ON patient_stays (bed_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS prescriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    patient_id        UUID,
    admission_id      UUID REFERENCES admissions(id),
    status            TEXT DEFAULT 'ACTIVE',
    data              JSONB,
    created_at        TIMESTAMPTZ DEFAULT now(),
    created_by        TEXT,
    tenant_patient_id UUID REFERENCES patients_tenant(tenant_patient_id)
);
CREATE INDEX IF NOT EXISTS idx_rx_tenant ON prescriptions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions (patient_id);
CREATE INDEX IF NOT EXISTS idx_rx_admission ON prescriptions (admission_id);
CREATE INDEX IF NOT EXISTS idx_rx_status ON prescriptions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_patient ON prescriptions (tenant_patient_id);

CREATE TABLE IF NOT EXISTS medication_dispense_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    prescription_id UUID,
    admission_id    UUID,
    product_id      UUID NOT NULL,
    lot             TEXT,
    expiry          DATE,
    qty_dispensed   INTEGER NOT NULL,
    dispensed_by    TEXT,
    dispensed_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    patient_id        UUID,
    service_id        UUID,
    date_time         TIMESTAMPTZ NOT NULL,
    reason            TEXT,
    doctor_name       TEXT,
    status            TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    tenant_patient_id UUID
);

CREATE TABLE IF NOT EXISTS actes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    code        TEXT NOT NULL,
    designation TEXT NOT NULL,
    category    TEXT,
    price       NUMERIC,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 16. PUBLIC SCHEMA — AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    audit_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID,
    table_name    TEXT NOT NULL,
    record_id     UUID NOT NULL,
    action        TEXT NOT NULL,
    old_data      JSONB,
    new_data      JSONB,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by    UUID,
    operation_txid BIGINT
);

-- Prevent updates on audit log
CREATE OR REPLACE FUNCTION fn_audit_no_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be updated or deleted';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER audit_log_no_update
    BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW
    EXECUTE FUNCTION fn_audit_no_update();

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION fn_generic_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_record_id UUID;
    v_changed_by UUID;
BEGIN
    v_tenant_id := COALESCE(
        current_setting('app.tenant_id', true)::uuid,
        NULL
    );
    v_changed_by := COALESCE(
        current_setting('app.user_id', true)::uuid,
        NULL
    );

    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
        IF v_record_id IS NULL THEN v_record_id := COALESCE(OLD.tenant_patient_id, OLD.person_id, OLD.relationship_id, OLD.decision_maker_id, OLD.emergency_contact_id, OLD.legal_guardian_id, OLD.patient_insurance_id, OLD.contact_id, OLD.address_id); END IF;
        INSERT INTO audit_log (tenant_id, table_name, record_id, action, old_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_record_id, 'DELETE', row_to_json(OLD)::jsonb, v_changed_by, txid_current());
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_record_id := NEW.id;
        IF v_record_id IS NULL THEN v_record_id := COALESCE(NEW.tenant_patient_id, NEW.person_id, NEW.relationship_id, NEW.decision_maker_id, NEW.emergency_contact_id, NEW.legal_guardian_id, NEW.patient_insurance_id, NEW.contact_id, NEW.address_id); END IF;
        INSERT INTO audit_log (tenant_id, table_name, record_id, action, old_data, new_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_record_id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_changed_by, txid_current());
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        v_record_id := NEW.id;
        IF v_record_id IS NULL THEN v_record_id := COALESCE(NEW.tenant_patient_id, NEW.person_id, NEW.relationship_id, NEW.decision_maker_id, NEW.emergency_contact_id, NEW.legal_guardian_id, NEW.patient_insurance_id, NEW.contact_id, NEW.address_id); END IF;
        INSERT INTO audit_log (tenant_id, table_name, record_id, action, new_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_record_id, 'INSERT', row_to_json(NEW)::jsonb, v_changed_by, txid_current());
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Audit triggers on EMR tables
CREATE OR REPLACE TRIGGER audit_patients_tenant AFTER INSERT OR UPDATE OR DELETE ON patients_tenant FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();

-- ============================================================================
-- 17. PUBLIC SCHEMA — MIGRATION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS _migration_issues (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table      TEXT NOT NULL,
    source_id         TEXT,
    issue_type        TEXT NOT NULL,
    issue_description TEXT,
    row_data          JSONB,
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================

-- ============================================================================
-- 18. MISSING TABLES (COVERAGES & MEMBERS) - RECONSTRUCTED
-- ============================================================================

CREATE TABLE IF NOT EXISTS coverages (
    coverage_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    organisme_id      UUID NOT NULL, -- References reference.organismes(id)
    policy_number     TEXT,
    group_number      TEXT,
    plan_name         TEXT,
    coverage_type_code TEXT,
    effective_from    DATE,
    effective_to      DATE,
    status            TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coverages_tenant ON coverages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coverages_organisme ON coverages(organisme_id);

CREATE TABLE IF NOT EXISTS coverage_members (
    coverage_member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    coverage_id        UUID NOT NULL REFERENCES coverages(coverage_id) ON DELETE CASCADE,
    tenant_patient_id  UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    relationship_to_subscriber_code TEXT NOT NULL,
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cov_mem_coverage ON coverage_members(coverage_id);
CREATE INDEX IF NOT EXISTS idx_cov_mem_patient ON coverage_members(tenant_patient_id);

-- ============================================================================
-- 19. EPIC COVERAGE REFACTOR (Migration 047 Tables)
-- ============================================================================

-- Coverage Change History (Audit Log for Master Tables)
CREATE TABLE IF NOT EXISTS coverage_change_history (
  change_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL,

  coverage_id            uuid NOT NULL,
  coverage_member_id     uuid NULL,

  change_type_code       text NOT NULL,
  field_name             text NULL,
  old_value              text NULL,
  new_value              text NULL,

  change_source          text NOT NULL,
  changed_by_user_id     uuid NULL,
  change_reason          text NULL,

  changed_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coverage_history_coverage ON coverage_change_history (tenant_id, coverage_id);
CREATE INDEX IF NOT EXISTS idx_coverage_history_member ON coverage_change_history (tenant_id, coverage_member_id);
CREATE INDEX IF NOT EXISTS idx_coverage_history_date ON coverage_change_history (tenant_id, changed_at DESC);

-- Admission Snapshot Tables

-- admission_coverages
CREATE TABLE IF NOT EXISTS admission_coverages (
  admission_coverage_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  admission_id            uuid NOT NULL REFERENCES admissions(id),

  coverage_id             uuid NOT NULL REFERENCES coverages(coverage_id),

  filing_order            integer NOT NULL,

  -- Snapshot of key billing fields
  organisme_id            uuid NOT NULL,
  policy_number           text NULL,
  group_number            text NULL,
  plan_name               text NULL,
  coverage_type_code      text NULL,

  -- Snapshot of subscriber identity
  subscriber_first_name   text NULL,
  subscriber_last_name    text NULL,
  subscriber_identity_type text NULL,
  subscriber_identity_value text NULL,
  subscriber_issuing_country text NULL,

  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cov_admission ON admission_coverages (tenant_id, admission_id);
CREATE INDEX IF NOT EXISTS idx_adm_cov_coverage ON admission_coverages (tenant_id, coverage_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_adm_cov_order ON admission_coverages (tenant_id, admission_id, filing_order);

-- admission_coverage_members
CREATE TABLE IF NOT EXISTS admission_coverage_members (
  admission_coverage_member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    uuid NOT NULL,

  admission_coverage_id        uuid NOT NULL REFERENCES admission_coverages(admission_coverage_id) ON DELETE CASCADE,

  tenant_patient_id            uuid NULL,

  -- Snapshot of member identity
  member_first_name            text NULL,
  member_last_name             text NULL,
  relationship_to_subscriber_code text NULL,
  member_identity_type         text NULL,
  member_identity_value        text NULL,
  member_issuing_country       text NULL,

  created_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_mem_coverage ON admission_coverage_members (tenant_id, admission_coverage_id);
CREATE INDEX IF NOT EXISTS idx_adm_mem_patient ON admission_coverage_members (tenant_id, tenant_patient_id);

-- Admission Coverage Change History
CREATE TABLE IF NOT EXISTS admission_coverage_change_history (
  change_id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                      uuid NOT NULL,

  admission_id                   uuid NOT NULL,
  admission_coverage_id          uuid NULL,
  admission_coverage_member_id   uuid NULL,

  change_type_code               text NOT NULL,

  field_name                     text NULL,
  old_value                      text NULL,
  new_value                      text NULL,

  change_source                  text NOT NULL,
  changed_by_user_id             uuid NULL,
  change_reason                  text NULL,

  changed_at                     timestamptz NOT NULL DEFAULT now(),

  CHECK (
    admission_coverage_id IS NOT NULL
    OR admission_coverage_member_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_adm_hist_admission ON admission_coverage_change_history (tenant_id, admission_id);
CREATE INDEX IF NOT EXISTS idx_adm_hist_coverage ON admission_coverage_change_history (tenant_id, admission_coverage_id);
CREATE INDEX IF NOT EXISTS idx_adm_hist_date ON admission_coverage_change_history (tenant_id, changed_at DESC);

-- ============================================================================
-- 21. PRESCRIPTION EVENTS AND ADMINISTRATION EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS prescription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    admission_id UUID,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration INTEGER,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rx_events_tenant ON prescription_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rx_events_prescription ON prescription_events(prescription_id);
CREATE INDEX IF NOT EXISTS idx_rx_events_status ON prescription_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_presc_events_by_admission_time ON prescription_events(tenant_id, admission_id, scheduled_at);

CREATE TABLE IF NOT EXISTS administration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    prescription_event_id UUID NOT NULL REFERENCES prescription_events(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,
    performed_by TEXT,
    performed_by_user_id UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_events_by_presc_event_time
    ON administration_events(tenant_id, prescription_event_id, occurred_at);

-- ============================================================================
-- 22. SURVEILLANCE HOUR BUCKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS surveillance_hour_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    admission_id UUID, -- Can be null, as MAR flowsheet is patient-centric
    tenant_patient_id UUID NOT NULL,
    bucket_start TIMESTAMPTZ NOT NULL,
    values JSONB NOT NULL DEFAULT '{}'::jsonb,
    revision INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id UUID,
    UNIQUE (tenant_id, tenant_patient_id, bucket_start)
);


CREATE INDEX IF NOT EXISTS idx_surveillance_buckets_patient ON surveillance_hour_buckets(tenant_id, tenant_patient_id, bucket_start);
CREATE INDEX IF NOT EXISTS idx_surveillance_buckets_admission ON surveillance_hour_buckets(tenant_id, admission_id, bucket_start);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_surv_hour_buckets_upd
    BEFORE UPDATE ON surveillance_hour_buckets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 23. REFERENCE SCHEMA VERSION TRACKER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reference_schema_version (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    current_version INTEGER NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.reference_schema_version (id, current_version)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;


-- Migration 066: Fix blood bag cancellation logic
-- Migration 066: Fix blood bag cancellation logic
-- When a START event is cancelled (start_exists = FALSE), the bag's assigned_prescription_event_id
-- should be set back to NULL, so the bag is fully released for another prescription event.
-- We also ensure that bags marked as 'DISCARDED' are never modified.

CREATE OR REPLACE FUNCTION public.recompute_blood_bag_status(p_bag_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    start_exists BOOLEAN;
    end_exists BOOLEAN;
BEGIN

IF (SELECT status FROM public.transfusion_blood_bags WHERE id = p_bag_id) = 'DISCARDED' THEN
    RETURN;
END IF;

SELECT EXISTS (
    SELECT 1
    FROM public.administration_events ae
    JOIN public.administration_event_blood_bags aebb
        ON ae.id = aebb.administration_event_id
    WHERE aebb.blood_bag_id = p_bag_id
    AND ae.status = 'ACTIVE'
    AND ae.action_type = 'started'
) INTO start_exists;

SELECT EXISTS (
    SELECT 1
    FROM public.administration_events ae
    JOIN public.administration_event_blood_bags aebb
        ON ae.id = aebb.administration_event_id
    WHERE aebb.blood_bag_id = p_bag_id
    AND ae.status = 'ACTIVE'
    AND ae.action_type = 'ended'
) INTO end_exists;

IF start_exists = FALSE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'RECEIVED',
        assigned_prescription_event_id = NULL
    WHERE id = p_bag_id;

ELSIF start_exists = TRUE AND end_exists = FALSE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'IN_USE'
    WHERE id = p_bag_id;

ELSIF start_exists = TRUE AND end_exists = TRUE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'USED'
    WHERE id = p_bag_id;

END IF;

END;
$$;
