-- Tenant Patient Rework
-- Migration ID: 022
-- Description: Implements local patient chart, separate from global identity.

-- 1. Create Patients Tenant (Chart)
CREATE TABLE IF NOT EXISTS patients_tenant (
    tenant_patient_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             TEXT NOT NULL,
    global_patient_id     UUID NOT NULL, -- Logical reference to sahty_global.patients_global
    medical_record_number TEXT,
    status                TEXT CHECK (status IN ('ACTIVE','MERGED','INACTIVE')) DEFAULT 'ACTIVE',
    nationality_id        UUID, -- Logical reference to sahty_global.countries
    created_at            TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, medical_record_number)
);

CREATE INDEX IF NOT EXISTS idx_patients_tenant_global ON patients_tenant(global_patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_tenant_mrn ON patients_tenant(tenant_id, medical_record_number);

-- 2. Contact Info (Local)
CREATE TABLE IF NOT EXISTS patient_contacts (
    contact_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_patient_id UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    phone             TEXT,
    email             TEXT,
    created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_contacts_patient ON patient_contacts(tenant_patient_id);

-- 3. Addresses (Local)
CREATE TABLE IF NOT EXISTS patient_addresses (
    address_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_patient_id UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    address_line      TEXT,
    city              TEXT,
    country_id        UUID, -- Logical reference to sahty_global.countries
    created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_addresses_patient ON patient_addresses(tenant_patient_id);

-- 4. Insurance (Local, Versioned)
CREATE TABLE IF NOT EXISTS patient_insurances (
    patient_insurance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_patient_id    UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    insurance_org_id     UUID NOT NULL, -- Logical reference to sahty_global.organismes
    
    policy_number        TEXT,
    plan_name            TEXT,
    subscriber_name      TEXT,

    -- Business coverage
    coverage_valid_from  DATE,
    coverage_valid_to    DATE,

    -- System versioning
    row_valid_from       TIMESTAMPTZ NOT NULL DEFAULT now(),
    row_valid_to         TIMESTAMPTZ,

    created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_insurances_patient ON patient_insurances(tenant_patient_id);
-- Active rows are those where row_valid_to IS NULL
CREATE INDEX IF NOT EXISTS idx_patient_insurances_active ON patient_insurances(tenant_patient_id) WHERE row_valid_to IS NULL;


-- 5. Update Clinical Tables to reference Tenant Patient

-- Admissions
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS tenant_patient_id UUID REFERENCES patients_tenant(tenant_patient_id);
-- Make old column nullable/deprecated (we don't drop to avoid accidental data loss unless explicitly reset)
ALTER TABLE admissions ALTER COLUMN patient_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admissions_tenant_patient ON admissions(tenant_patient_id);

-- Prescriptions
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS tenant_patient_id UUID REFERENCES patients_tenant(tenant_patient_id);
ALTER TABLE prescriptions ALTER COLUMN patient_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_patient ON prescriptions(tenant_patient_id);

-- Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_patient_id UUID REFERENCES patients_tenant(tenant_patient_id);
ALTER TABLE appointments ALTER COLUMN patient_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_patient ON appointments(tenant_patient_id);
