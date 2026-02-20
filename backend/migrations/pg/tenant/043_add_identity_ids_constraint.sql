-- Migration 043: Add Identity IDs Unique Constraint for Sync Idempotency

-- Required for ON CONFLICT updates during syncDown (EMPI linkage)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_identity_per_patient 
ON identity_ids (tenant_id, tenant_patient_id, identity_type_code);
