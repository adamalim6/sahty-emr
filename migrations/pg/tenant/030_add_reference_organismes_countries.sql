-- Migration: Add Reference Schema and Seed Data
-- ID: 030
-- Description: Creates the reference schema in the tenant DB and mirrors global reference data (organismes, countries) to fix empty UI selectors.

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS reference;

-- 2. Organismes (Mirror of sahty_global.organismes)
CREATE TABLE IF NOT EXISTS reference.organismes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designation TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('ASSURANCE', 'ORGANISME_CONVENTIONNE', 'MUTUELLE')),
    sub_type TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_organismes_active ON reference.organismes(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ref_organismes_name ON reference.organismes(designation);

-- 3. Countries (Mirror of sahty_global.countries)
CREATE TABLE IF NOT EXISTS reference.countries (
    country_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iso_code   TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ref_countries_iso ON reference.countries(iso_code);

-- 4. Seed Countries (Standard ISO list)
INSERT INTO reference.countries (iso_code, name) VALUES
    ('MA', 'Maroc'),
    ('FR', 'France'),
    ('US', 'États-Unis'),
    ('ES', 'Espagne'),
    ('DZ', 'Algérie'),
    ('TN', 'Tunisie'),
    ('SN', 'Sénégal'),
    ('MR', 'Mauritanie'),
    ('BE', 'Belgique'),
    ('CA', 'Canada'),
    ('DE', 'Allemagne'),
    ('IT', 'Italie'),
    ('SA', 'Arabie Saoudite'),
    ('AE', 'Émirats Arabes Unis')
ON CONFLICT (iso_code) DO NOTHING;

-- 5. Seed Organismes (Common Moroccan Insurances)
INSERT INTO reference.organismes (designation, category, sub_type) VALUES
    ('CNSS', 'ASSURANCE', 'PUBLIC'),
    ('CNOPS', 'ASSURANCE', 'PUBLIC'),
    ('AXA Assurance', 'ASSURANCE', 'PRIVATE'),
    ('Sanad', 'ASSURANCE', 'PRIVATE'),
    ('Wafa Assurance', 'ASSURANCE', 'PRIVATE'),
    ('RMA', 'ASSURANCE', 'PRIVATE'),
    ('Saham (Sanlam)', 'ASSURANCE', 'PRIVATE'),
    ('MAMDA', 'MUTUELLE', 'PRIVATE'),
    ('MCMA', 'MUTUELLE', 'PRIVATE'),
    ('AtlantaSanad', 'ASSURANCE', 'PRIVATE'),
    ('La Marocaine Vie', 'ASSURANCE', 'PRIVATE')
ON CONFLICT DO NOTHING;
