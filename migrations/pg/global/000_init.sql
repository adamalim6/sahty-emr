-- PostgreSQL Global Schema for Sahty EMR
-- Database: sahty_global

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CLIENTS (Healthcare Organizations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    designation TEXT NOT NULL,
    siege_social TEXT,
    representant_legal TEXT,
    country TEXT DEFAULT 'MAROC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ORGANISMES (Insurance/Payment Organizations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organismes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designation TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('ASSURANCE', 'ORGANISME_CONVENTIONNE', 'MUTUELLE')),
    sub_type TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USERS (System Users - Global)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nom TEXT,
    prenom TEXT,
    user_type TEXT NOT NULL CHECK (user_type IN ('SUPER_ADMIN', 'TENANT_SUPERADMIN')),
    role_code TEXT,
    role_id UUID,
    client_id UUID REFERENCES clients(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_client ON users(client_id);
CREATE INDEX idx_users_active ON users(active) WHERE active = TRUE;

-- ============================================================================
-- PATIENTS (Master Patient Index)
-- ============================================================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ipp TEXT UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('M', 'F', 'OTHER')),
    cin TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    nationality TEXT,
    marital_status TEXT,
    profession TEXT,
    blood_group TEXT,
    is_payant BOOLEAN DEFAULT FALSE,
    insurance_data JSONB,
    emergency_contacts JSONB,
    guardian_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_ipp ON patients(ipp);
CREATE INDEX idx_patients_cin ON patients(cin) WHERE cin IS NOT NULL;
CREATE INDEX idx_patients_name ON patients(last_name, first_name);

-- ============================================================================
-- GLOBAL DCI (Active Ingredients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_dci (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    atc_code TEXT,
    therapeutic_class TEXT,
    synonyms JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dci_name ON global_dci(name);
CREATE INDEX idx_dci_atc ON global_dci(atc_code) WHERE atc_code IS NOT NULL;

-- ============================================================================
-- GLOBAL PRODUCTS (Product Catalog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('MEDICAMENT', 'CONSOMMABLE', 'DISPOSITIF_MEDICAL')),
    name TEXT NOT NULL,
    form TEXT,
    dci_composition JSONB,
    presentation TEXT,
    manufacturer TEXT,
    ppv NUMERIC(12,4),
    ph NUMERIC(12,4),
    pfht NUMERIC(12,4),
    class_therapeutique TEXT,
    sahty_code TEXT,
    code TEXT,
    units_per_pack INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_name ON global_products(name);
CREATE INDEX idx_products_sahty ON global_products(sahty_code) WHERE sahty_code IS NOT NULL;
CREATE INDEX idx_products_active ON global_products(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- GLOBAL SUPPLIERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tax_id TEXT,
    address TEXT,
    contact_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_active ON global_suppliers(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- GLOBAL ACTES (Medical Procedures)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_actes (
    code_sih TEXT PRIMARY KEY,
    libelle_sih TEXT NOT NULL,
    famille_sih TEXT,
    sous_famille_sih TEXT,
    code_ngap TEXT,
    libelle_ngap TEXT,
    cotation_ngap TEXT,
    code_ccam TEXT,
    libelle_ccam TEXT,
    type_acte TEXT,
    duree_moyenne INTEGER,
    actif BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- GLOBAL ROLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB,
    modules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GLOBAL ATC (Anatomical Therapeutic Chemical Classification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_atc (
    code TEXT PRIMARY KEY,
    label_fr TEXT,
    label_en TEXT,
    level INTEGER,
    parent TEXT REFERENCES global_atc(code) ON DELETE SET NULL
);

CREATE INDEX idx_atc_parent ON global_atc(parent);
CREATE INDEX idx_atc_level ON global_atc(level);

-- ============================================================================
-- GLOBAL EMDN (European Medical Device Nomenclature)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_emdn (
    code TEXT PRIMARY KEY,
    label_fr TEXT,
    label_en TEXT,
    level INTEGER,
    parent TEXT REFERENCES global_emdn(code) ON DELETE SET NULL
);

CREATE INDEX idx_emdn_parent ON global_emdn(parent);

-- ============================================================================
-- GLOBAL PRODUCT PRICE HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_product_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES global_products(id) ON DELETE CASCADE,
    ppv NUMERIC(12,4),
    ph NUMERIC(12,4),
    pfht NUMERIC(12,4),
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_product ON global_product_price_history(product_id);
CREATE INDEX idx_price_history_dates ON global_product_price_history(valid_from, valid_to);

-- ============================================================================
-- MIGRATION ISSUES (Quarantine table for bad data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS _migration_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table TEXT NOT NULL,
    source_id TEXT,
    issue_type TEXT NOT NULL,
    issue_description TEXT,
    row_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
