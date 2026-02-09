
BEGIN;

-- 1. Create table in PUBLIC schema
CREATE TABLE IF NOT EXISTS public.identity_document_types (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    validation_regex TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Copy data from identity.document_types
INSERT INTO public.identity_document_types (code, label, validation_regex, created_at, updated_at)
SELECT code, label, validation_regex, created_at, updated_at
FROM identity.document_types
ON CONFLICT (code) DO NOTHING;

-- 3. Update FK in identity.master_patient_documents
ALTER TABLE identity.master_patient_documents
DROP CONSTRAINT IF EXISTS master_patient_documents_document_type_code_fkey;

ALTER TABLE identity.master_patient_documents
ADD CONSTRAINT master_patient_documents_document_type_code_fkey
FOREIGN KEY (document_type_code)
REFERENCES public.identity_document_types (code)
ON UPDATE CASCADE;

-- 4. Drop table in identity schema
DROP TABLE IF EXISTS identity.document_types;

COMMIT;
