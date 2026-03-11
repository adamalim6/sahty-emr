-- 075_create_patient_observations.sql

BEGIN;

CREATE TABLE patient_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_patient_id UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    created_by UUID NOT NULL REFERENCES auth.users(user_id),

    author_role TEXT NOT NULL CHECK (author_role IN ('DOCTOR', 'NURSE')),
    note_type TEXT NOT NULL CHECK (note_type IN ('ADMISSION', 'PROGRESS', 'DISCHARGE', 'CONSULT', 'GENERAL')),
    privacy_level TEXT NOT NULL DEFAULT 'NORMAL' CHECK (privacy_level IN ('NORMAL', 'SENSITIVE', 'RESTRICTED')),
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'SIGNED')),

    declared_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NULL,

    signed_at TIMESTAMPTZ NULL,
    signed_by UUID NULL REFERENCES auth.users(user_id),

    parent_observation_id UUID NULL REFERENCES patient_observations(id),

    linked_admission_id UUID NULL,
    linked_allergy_id UUID NULL,
    linked_addiction_id UUID NULL,

    body_html TEXT NOT NULL CHECK (length(body_html) < 200000),
    body_plain TEXT NOT NULL,

    CONSTRAINT chk_no_self_parent CHECK (
        parent_observation_id IS NULL OR parent_observation_id <> id
    )
);

-- Indexes

CREATE INDEX idx_patient_observations_timeline 
ON patient_observations (tenant_patient_id, declared_time DESC, created_at DESC);

CREATE INDEX idx_patient_observations_role 
ON patient_observations (tenant_patient_id, author_role, declared_time DESC);

CREATE INDEX idx_patient_observations_status 
ON patient_observations (tenant_patient_id, status, declared_time DESC);

CREATE INDEX idx_patient_observations_parent 
ON patient_observations(parent_observation_id) WHERE parent_observation_id IS NOT NULL;

CREATE INDEX idx_patient_observations_parent_patient 
ON patient_observations(tenant_patient_id, parent_observation_id) WHERE parent_observation_id IS NOT NULL;

CREATE INDEX idx_patient_observations_linked_admission 
ON patient_observations(linked_admission_id) WHERE linked_admission_id IS NOT NULL;

CREATE INDEX idx_patient_observations_linked_allergy 
ON patient_observations(linked_allergy_id) WHERE linked_allergy_id IS NOT NULL;

CREATE INDEX idx_patient_observations_linked_addiction 
ON patient_observations(linked_addiction_id) WHERE linked_addiction_id IS NOT NULL;

COMMIT;
