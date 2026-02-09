
export const REFERENCE_TABLES_ORDER = [
    'identity_document_types',
    'countries',
    'organismes',
    'global_roles',
    'global_actes',
    'global_atc',
    'global_emdn',
    'global_suppliers',
    'global_dci',
    'global_products',                // Must come before global_product_price_history (FK)
    'global_product_price_history',
];

export interface ReferenceTableSpec {
    tableName: string;
    ddl: string;
}

export const REFERENCE_SCHEMA_DDL: ReferenceTableSpec[] = [
    {
        tableName: 'identity_document_types',
        ddl: `
            DROP TABLE IF EXISTS reference.identity_document_types CASCADE;
            CREATE TABLE reference.identity_document_types (
                code TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                validation_regex TEXT,
                created_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ
            );
        `
    },
    {
        tableName: 'countries',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.countries (
                country_id UUID PRIMARY KEY,
                iso_code TEXT,
                name TEXT NOT NULL
            );
        `
    },
    {
        tableName: 'organismes',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.organismes (
                id UUID PRIMARY KEY,
                designation TEXT NOT NULL,
                category TEXT NOT NULL CHECK (category IN ('ASSURANCE', 'ORGANISME_CONVENTIONNE', 'MUTUELLE')),
                sub_type TEXT,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ
            );
        `
    },
    {
        tableName: 'global_roles',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_roles (
                id UUID PRIMARY KEY,
                code TEXT,
                name TEXT NOT NULL,
                description TEXT,
                permissions JSONB,
                modules JSONB,
                assignable_by TEXT,
                created_at TIMESTAMPTZ
            );
        `
    },
    {
        tableName: 'global_actes',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_actes (
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
        `
    },
    {
        tableName: 'global_atc',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_atc (
                code TEXT PRIMARY KEY,
                label_fr TEXT,
                label_en TEXT,
                level INTEGER,
                parent TEXT -- References self, can add FK reference.global_atc(code) if ordered carefully
            );
            CREATE INDEX IF NOT EXISTS idx_ref_atc_parent ON reference.global_atc(parent);
            CREATE INDEX IF NOT EXISTS idx_ref_atc_level ON reference.global_atc(level);
        `
    },
    {
        tableName: 'global_emdn',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_emdn (
                code TEXT PRIMARY KEY,
                label_fr TEXT,
                label_en TEXT,
                level INTEGER,
                parent TEXT -- References self
            );
            CREATE INDEX IF NOT EXISTS idx_ref_emdn_parent ON reference.global_emdn(parent);
        `
    },
    {
        tableName: 'global_suppliers',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_suppliers (
                id UUID PRIMARY KEY,
                name TEXT NOT NULL,
                tax_id TEXT,
                address TEXT,
                contact_info JSONB,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS idx_ref_suppliers_active ON reference.global_suppliers(is_active) WHERE is_active = TRUE;
        `
    },
    {
        tableName: 'global_dci',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_dci (
                id UUID PRIMARY KEY,
                name TEXT NOT NULL,
                atc_code TEXT,
                therapeutic_class TEXT,
                synonyms JSONB,
                created_at TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS idx_ref_dci_name ON reference.global_dci(name);
            CREATE INDEX IF NOT EXISTS idx_ref_dci_atc ON reference.global_dci(atc_code) WHERE atc_code IS NOT NULL;
        `
    },
    {
        tableName: 'global_products',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_products (
                id UUID PRIMARY KEY,
                type TEXT NOT NULL,
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
                created_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS idx_ref_products_name ON reference.global_products(name);
            CREATE INDEX IF NOT EXISTS idx_ref_products_sahty ON reference.global_products(sahty_code) WHERE sahty_code IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_ref_products_active ON reference.global_products(is_active) WHERE is_active = TRUE;
        `
    },
    {
        tableName: 'global_product_price_history',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_product_price_history (
                id UUID PRIMARY KEY,
                product_id UUID NOT NULL REFERENCES reference.global_products(id) ON DELETE CASCADE,
                ppv NUMERIC(12,4),
                ph NUMERIC(12,4),
                pfht NUMERIC(12,4),
                valid_from TIMESTAMPTZ,
                valid_to TIMESTAMPTZ,
                created_at TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS idx_ref_price_hist_product ON reference.global_product_price_history(product_id);
            CREATE INDEX IF NOT EXISTS idx_ref_price_hist_dates ON reference.global_product_price_history(valid_from, valid_to);
        `
    }
];
