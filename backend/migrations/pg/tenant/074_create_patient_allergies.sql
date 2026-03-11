-- 074_create_patient_allergies.sql

BEGIN;

CREATE TABLE patient_allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    tenant_patient_id UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    
    allergen_dci_id UUID NOT NULL REFERENCES reference.global_dci(id),
    allergen_name_snapshot TEXT NOT NULL,
    
    allergy_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    reaction_description TEXT,
    declared_at DATE,
    
    status TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,

    CONSTRAINT chk_patient_allergies_status CHECK (status IN ('ACTIVE', 'RESOLVED', 'ENTERED_IN_ERROR'))
);

CREATE TABLE patient_allergy_manifestations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    patient_allergy_id UUID NOT NULL REFERENCES patient_allergies(id) ON DELETE CASCADE,
    manifestation_code TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,

    CONSTRAINT chk_patient_allergy_manifestations_code CHECK (manifestation_code IN ('CUTANEE', 'RESPIRATOIRE', 'DIGESTIVE', 'CARDIOVASCULAIRE', 'NEUROLOGIQUE')),
    UNIQUE(patient_allergy_id, manifestation_code)
);

CREATE TABLE patient_allergy_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    tenant_patient_id UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    patient_allergy_id UUID NOT NULL REFERENCES patient_allergies(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL,
    changed_field TEXT,
    
    old_value TEXT,
    new_value TEXT,
    change_note TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,

    CONSTRAINT chk_patient_allergy_history_event_type CHECK (event_type IN ('CREATED', 'DETAILS_UPDATED', 'STATUS_CHANGED'))
);

-- Indexes for performance
CREATE INDEX idx_patient_allergies_patient ON patient_allergies (tenant_patient_id, status);
CREATE INDEX idx_patient_allergy_history_allergy ON patient_allergy_history (patient_allergy_id, created_at);
CREATE INDEX idx_patient_allergies_patient_dci ON patient_allergies (tenant_patient_id, allergen_dci_id);
CREATE INDEX idx_patient_active_allergies ON patient_allergies (tenant_patient_id) WHERE status = 'ACTIVE';



COMMIT;
