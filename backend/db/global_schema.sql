-- Global Database Schema

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    designation TEXT NOT NULL, -- Name
    siege_social TEXT,
    representant_legal TEXT,
    country TEXT DEFAULT 'MAROC',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organismes (
    id TEXT PRIMARY KEY,
    designation TEXT NOT NULL,
    category TEXT NOT NULL, -- ASSURANCE, ORGANISME_CONVENTIONNE
    sub_type TEXT, -- CLASSIQUE, TAKAFUL, MUTUELLE, etc.
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nom TEXT,
    prenom TEXT,
    user_type TEXT NOT NULL, -- SUPER_ADMIN, TENANT_SUPERADMIN
    role_code TEXT,
    role_id TEXT, -- Link to global_roles
    client_id TEXT, -- Link to clients (for tenant admins)
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    ipp TEXT UNIQUE, -- Global Patient ID
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    dateOfBirth TEXT, -- ISO Date
    gender TEXT,
    cin TEXT, -- National ID
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    nationality TEXT,
    maritalStatus TEXT,
    profession TEXT,
    bloodGroup TEXT,
    isPayant BOOLEAN DEFAULT 0,
    insurance_data TEXT, -- JSON blob for insurance details
    emergency_contacts TEXT, -- JSON blob
    guardian_data TEXT, -- JSON blob
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS global_dci (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    atc_code TEXT,
    therapeutic_class TEXT,
    synonyms TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS global_products (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    form TEXT,
    dci_composition TEXT,
    presentation TEXT,
    manufacturer TEXT,
    ppv REAL,
    ph REAL,
    pfht REAL,
    class_therapeutique TEXT,
    sahty_code TEXT,
    code TEXT, -- GTIN
    units_per_pack INTEGER DEFAULT 1,
    default_presc_unit TEXT,
    default_presc_route TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS global_suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tax_id TEXT,
    address TEXT,
    contact_info TEXT, -- JSON
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Missing tables added for completeness
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
    actif BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS global_roles (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    permissions TEXT, -- JSON array of permission strings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS global_atc (
    code TEXT PRIMARY KEY,
    label_fr TEXT,
    label_en TEXT,
    level INTEGER,
    parent TEXT,
    FOREIGN KEY(parent) REFERENCES global_atc(code)
);

CREATE TABLE IF NOT EXISTS global_emdn (
    code TEXT PRIMARY KEY,
    label_fr TEXT,
    label_en TEXT,
    level INTEGER,
    parent TEXT,
    FOREIGN KEY(parent) REFERENCES global_emdn(code)
);

CREATE TABLE IF NOT EXISTS global_product_price_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    ppv REAL,
    ph REAL,
    pfht REAL,
    valid_from DATETIME,
    valid_to DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES global_products(id)
);
