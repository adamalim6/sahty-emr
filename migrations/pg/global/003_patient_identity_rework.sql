-- Global Patient Identity Rework
-- Migration ID: 003
-- Description: Replaces legacy patients table with clean Identity Layer

-- 1. Drop Legacy Table
DROP TABLE IF EXISTS patients CASCADE;

-- 2. Create Global Patients (Identity Only)
CREATE TABLE IF NOT EXISTS patients_global (
    global_patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    date_of_birth     DATE NOT NULL,
    gender            TEXT CHECK (gender IN ('M', 'F', 'OTHER')),
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_global_name ON patients_global(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_global_dob ON patients_global(date_of_birth);

-- 3. Identity Document System
CREATE TABLE IF NOT EXISTS identity_document_types (
    document_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code             TEXT UNIQUE NOT NULL,  -- e.g. CIN, PASSPORT
    label            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS global_identity_documents (
    identity_document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_patient_id    UUID NOT NULL REFERENCES patients_global(global_patient_id) ON DELETE CASCADE,
    document_type_id     UUID NOT NULL REFERENCES identity_document_types(document_type_id),
    document_number      TEXT NOT NULL,
    is_primary           BOOLEAN DEFAULT FALSE,
    expires_at           DATE,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now(),
    UNIQUE (document_type_id, document_number)
);

CREATE INDEX IF NOT EXISTS idx_identity_docs_patient ON global_identity_documents(global_patient_id);
CREATE INDEX IF NOT EXISTS idx_identity_docs_number ON global_identity_documents(document_number);

-- 4. Country / Nationality Master
CREATE TABLE IF NOT EXISTS countries (
    country_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iso_code   TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL
);

-- 5. Seed Initial Data
INSERT INTO identity_document_types (code, label) VALUES
    ('CIN', 'Carte Nationale d''Identité'),
    ('PASSPORT', 'Passeport'),
    ('SEJOUR', 'Carte de Séjour')
ON CONFLICT (code) DO NOTHING;

INSERT INTO countries (iso_code, name) VALUES
    ('MA', 'Maroc'),
    ('FR', 'France'),
    ('US', 'États-Unis'),
    ('ES', 'Espagne'),
    ('DZ', 'Algérie'),
    ('TN', 'Tunisie'),
    ('SN', 'Sénégal'),
    ('MR', 'Mauritanie')
ON CONFLICT (iso_code) DO NOTHING;
