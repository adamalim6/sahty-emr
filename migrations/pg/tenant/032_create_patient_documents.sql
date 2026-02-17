-- Migration: Create Patient Documents Table
-- ID: 032
-- Description: Creates the patient_documents table to store identity documents in the tenant schema.
-- NOTE: Uses patient_id as FK column to match existing schema convention.

CREATE TABLE IF NOT EXISTS patient_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    document_type_code TEXT NOT NULL, -- e.g. 'CIN', 'PASSPORT'
    document_number TEXT NOT NULL,
    issuing_country_code TEXT NOT NULL DEFAULT 'MA',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by patient
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
-- Index for searching by document number (Universal Search)
CREATE INDEX IF NOT EXISTS idx_patient_documents_number ON patient_documents(document_number);
