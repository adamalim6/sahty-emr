
export const REFERENCE_TABLES_ORDER = [
    'identity_document_types',
    'countries',
    'organismes',
    'global_roles',
    'units',
    'routes',
    'sih_familles',
    'sih_sous_familles',
    'lab_sections',
    'lab_sub_sections',
    'global_actes',
    'lab_specimen_types',
    'lab_container_types',
    'lab_analytes',
    'lab_methods',
    'lab_canonical_allowed_values',
    // Lab config/linking tables moved to tenant public schema (no longer synced):
    // lab_panels, lab_panel_items, lab_act_analytes, lab_analyte_units, lab_analyte_aliases,
    // lab_analyte_contexts, lab_act_methods, lab_act_specimen_types, lab_act_contexts,
    // lab_reference_profiles, lab_reference_rules, lab_analyte_reference_ranges,
    // lab_analyte_external_codes, lab_specimen_container_types
    'global_atc',
    'global_emdn',
    'global_suppliers',
    'care_categories',
    'global_dci',
    'dci_synonyms',
    'global_products',                // Must come before global_product_price_history (FK)
    'global_product_price_history',
    'observation_parameters',
    'observation_groups',
    'observation_flowsheets',
    'flowsheet_groups',
    'group_parameters'
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
        tableName: 'units',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.units (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT UNIQUE NOT NULL,
                display TEXT NOT NULL,
                is_ucum BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                requires_fluid_info BOOLEAN NOT NULL DEFAULT FALSE,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `
    },
    {
        tableName: 'routes',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.routes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT UNIQUE NOT NULL,
                label TEXT NOT NULL,
                is_active BOOLEAN DEFAULT true,
                requires_fluid_info BOOLEAN NOT NULL DEFAULT FALSE,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_routes_active_order ON reference.routes (is_active, sort_order);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_sort_order_unique ON reference.routes (sort_order);
        `
    },
    {
        tableName: 'sih_familles',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.sih_familles (
                id uuid primary key default gen_random_uuid(),
                code text not null unique,
                libelle text not null,
                actif boolean not null default true,
                created_at timestamptz not null default now()
            );
        `
    },
    {
        tableName: 'sih_sous_familles',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.sih_sous_familles (
                id uuid primary key default gen_random_uuid(),
                famille_id uuid not null references reference.sih_familles(id) on delete restrict,
                code text not null,
                libelle text not null,
                actif boolean not null default true,
                created_at timestamptz not null default now(),
                unique (famille_id, code)
            );
        `
    },
    {
        tableName: 'lab_sections',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.lab_sections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT NOT NULL UNIQUE,
                libelle TEXT NOT NULL,
                description TEXT,
                actif BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_ref_lab_sections_actif ON reference.lab_sections(actif);
        `
    },
    {
        tableName: 'lab_sub_sections',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.lab_sub_sections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT NOT NULL UNIQUE,
                libelle TEXT NOT NULL,
                description TEXT,
                actif BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_ref_lab_sub_sections_actif ON reference.lab_sub_sections(actif);
        `
    },
    {
        tableName: 'global_actes',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.global_actes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code_sih TEXT UNIQUE NOT NULL,
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
                actif BOOLEAN DEFAULT TRUE,
                catalog_version INTEGER NOT NULL DEFAULT 1,
                famille_id UUID REFERENCES reference.sih_familles(id) ON DELETE SET NULL,
                sous_famille_id UUID REFERENCES reference.sih_sous_familles(id) ON DELETE SET NULL,
                lab_section_id UUID REFERENCES reference.lab_sections(id) ON DELETE SET NULL,
                lab_sub_section_id UUID REFERENCES reference.lab_sub_sections(id) ON DELETE SET NULL,
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
                is_lims_enabled BOOLEAN DEFAULT FALSE
            );
        `
    },
    {
        tableName: 'lab_specimen_types',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.lab_specimen_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT NOT NULL UNIQUE,
                libelle TEXT NOT NULL,
                description TEXT,
                actif BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `
    },
    {
        tableName: 'lab_container_types',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.lab_container_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT NOT NULL UNIQUE,
                libelle TEXT NOT NULL,
                description TEXT,
                tube_color TEXT,
                additive_type TEXT,
                actif BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
        `
    },
    {
        tableName: 'lab_analytes',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.lab_analytes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT NOT NULL UNIQUE,
                libelle TEXT NOT NULL,
                short_label TEXT,
                description TEXT,
                value_type TEXT NOT NULL CHECK (value_type IN ('NUMERIC', 'TEXT', 'BOOLEAN', 'CHOICE')),
                is_calculated BOOLEAN NOT NULL DEFAULT FALSE,
                actif BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `
    },
    {
        tableName: 'lab_methods',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.lab_methods (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT NOT NULL UNIQUE,
                libelle TEXT NOT NULL,
                description TEXT,
                actif BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
        tableName: 'care_categories',
        ddl: `
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
                care_category_id UUID REFERENCES reference.care_categories(id),
                created_at TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS idx_ref_dci_name ON reference.global_dci(name);
            CREATE INDEX IF NOT EXISTS idx_ref_dci_atc ON reference.global_dci(atc_code) WHERE atc_code IS NOT NULL;
        `
    },
    {
        tableName: 'dci_synonyms',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.dci_synonyms (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                dci_id UUID NOT NULL REFERENCES reference.global_dci(id) ON DELETE CASCADE,
                synonym TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_ref_dci_synonyms_dci_id ON reference.dci_synonyms(dci_id);
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
                default_presc_unit UUID,
                default_presc_route UUID,
                care_category_id UUID REFERENCES reference.care_categories(id),
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
    },
    {
        tableName: 'observation_parameters',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.observation_parameters (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT UNIQUE NOT NULL,
                label TEXT NOT NULL,
                unit TEXT,
                unit_id UUID,
                value_type TEXT NOT NULL,
                normal_min NUMERIC,
                normal_max NUMERIC,
                warning_min NUMERIC,
                warning_max NUMERIC,
                hard_min NUMERIC,
                hard_max NUMERIC,
                source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'calculated')),
                is_hydric_input BOOLEAN DEFAULT false,
                is_hydric_output BOOLEAN DEFAULT false,
                sort_order INT DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `
    },
    {
        tableName: 'observation_groups',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.observation_groups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT UNIQUE NOT NULL,
                label TEXT NOT NULL,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `
    },
    {
        tableName: 'observation_flowsheets',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.observation_flowsheets (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT UNIQUE NOT NULL,
                label TEXT NOT NULL,
                sort_order INT DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `
    },
    {
        tableName: 'flowsheet_groups',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.flowsheet_groups (
                flowsheet_id UUID NOT NULL REFERENCES reference.observation_flowsheets(id) ON DELETE CASCADE,
                group_id UUID NOT NULL REFERENCES reference.observation_groups(id) ON DELETE CASCADE,
                sort_order INT DEFAULT 0,
                PRIMARY KEY (flowsheet_id, group_id)
            );
        `
    },
    {
        tableName: 'group_parameters',
        ddl: `
            CREATE TABLE IF NOT EXISTS reference.group_parameters (
                group_id UUID NOT NULL REFERENCES reference.observation_groups(id) ON DELETE CASCADE,
                parameter_id UUID NOT NULL REFERENCES reference.observation_parameters(id) ON DELETE CASCADE,
                sort_order INT DEFAULT 0,
                PRIMARY KEY (group_id, parameter_id)
            );
        `
    }
];
