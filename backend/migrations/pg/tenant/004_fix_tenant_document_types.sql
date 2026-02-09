
BEGIN;

-- 1. Drop old FK
ALTER TABLE identity.master_patient_documents
DROP CONSTRAINT IF EXISTS master_patient_documents_document_type_code_fkey;

-- 2. Add new FK to reference schema
ALTER TABLE identity.master_patient_documents
ADD CONSTRAINT master_patient_documents_document_type_code_fkey
FOREIGN KEY (document_type_code)
REFERENCES reference.identity_document_types (code)
ON UPDATE CASCADE;

-- 3. Drop old table
DROP TABLE IF EXISTS identity.document_types;

COMMIT;
