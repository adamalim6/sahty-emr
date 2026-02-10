
-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS identity;

-- 2. Create Lookup Tables
-- (identity.document_types is now managed via Reference Data from sahty_global)

-- 3. Create Master Patients Table
CREATE TABLE IF NOT EXISTS identity.master_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dob DATE,
    sex TEXT,
    nationality_code TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, MERGED, DECEASED, INACTIVE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_master_patients_name_dob ON identity.master_patients (last_name, first_name, dob);
CREATE INDEX IF NOT EXISTS idx_master_patients_status ON identity.master_patients (status);

-- 4. Create Master Patient Documents
CREATE TABLE IF NOT EXISTS identity.master_patient_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id) ON DELETE CASCADE,
    document_type_code TEXT NOT NULL, -- Managed via Reference Data (no FK to identity schema)
    document_number TEXT NOT NULL,
    issuing_country_code TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_document UNIQUE (document_type_code, document_number, issuing_country_code)
);

CREATE INDEX IF NOT EXISTS idx_documents_master_patient_id ON identity.master_patient_documents (master_patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_lookup ON identity.master_patient_documents (document_type_code, document_number);

-- 5. Create Master Patient Aliases
CREATE TABLE IF NOT EXISTS identity.master_patient_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aliases_master_patient_id ON identity.master_patient_aliases (master_patient_id);

-- 6. Create Master Patient Merge Events
CREATE TABLE IF NOT EXISTS identity.master_patient_merge_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survivor_master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id),
    merged_master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id),
    merged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    merged_by TEXT,
    reason TEXT,
    
    CONSTRAINT uq_merged_patient UNIQUE (merged_master_patient_id)
);

CREATE INDEX IF NOT EXISTS idx_merge_survivor ON identity.master_patient_merge_events (survivor_master_patient_id);
CREATE INDEX IF NOT EXISTS idx_merge_merged ON identity.master_patient_merge_events (merged_master_patient_id);
