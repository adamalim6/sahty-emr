-- Patient Network (Persons, Relationships, Contacts)
-- Migration ID: 023
-- Description: Adds tables for non-patient persons and various patient relationship types.

-- 1. Persons (Non-patient people)
CREATE TABLE IF NOT EXISTS persons (
    person_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL, -- UUID in text format usually in this project

    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,

    phone       TEXT,
    email       TEXT,

    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persons_tenant ON persons(tenant_id);

-- 2. Patient Relationships (Social/Family)
CREATE TABLE IF NOT EXISTS patient_relationships (
    relationship_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            TEXT NOT NULL,

    subject_patient_id   UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),

    -- Exactly one of these two must be set:
    related_patient_id   UUID REFERENCES patients_tenant(tenant_patient_id),
    related_person_id    UUID REFERENCES persons(person_id),

    relationship_type    TEXT NOT NULL, -- e.g. 'MOTHER', 'FATHER', 'SPOUSE', 'CHILD'

    valid_from           DATE NOT NULL,
    valid_to             DATE,

    created_at           TIMESTAMPTZ DEFAULT now(),

    CHECK (
        (related_patient_id IS NOT NULL AND related_person_id IS NULL)
     OR (related_patient_id IS NULL AND related_person_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_patient_relationships_subject ON patient_relationships(subject_patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_relationships_related_patient ON patient_relationships(related_patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_relationships_related_person ON patient_relationships(related_person_id);

-- 3. Patient Emergency Contacts
CREATE TABLE IF NOT EXISTS patient_emergency_contacts (
    emergency_contact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            TEXT NOT NULL,

    tenant_patient_id    UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),

    -- Exactly one of these two:
    related_patient_id   UUID REFERENCES patients_tenant(tenant_patient_id),
    related_person_id    UUID REFERENCES persons(person_id),

    relationship_label   TEXT,    -- e.g. 'Mère', 'Conjoint', 'Ami'
    priority             INTEGER, -- 1 = first to call, 2 = second, etc.

    created_at           TIMESTAMPTZ DEFAULT now(),

    CHECK (
        (related_patient_id IS NOT NULL AND related_person_id IS NULL)
     OR (related_patient_id IS NULL AND related_person_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_patient_emergency_contacts_patient ON patient_emergency_contacts(tenant_patient_id);

-- 4. Patient Legal Guardians
CREATE TABLE IF NOT EXISTS patient_legal_guardians (
    legal_guardian_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            TEXT NOT NULL,

    tenant_patient_id    UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),

    -- Exactly one of these two:
    related_patient_id   UUID REFERENCES patients_tenant(tenant_patient_id),
    related_person_id    UUID REFERENCES persons(person_id),

    valid_from           DATE NOT NULL,
    valid_to             DATE,

    legal_basis          TEXT,  -- e.g. 'Parent', 'Court decision'

    created_at           TIMESTAMPTZ DEFAULT now(),

    CHECK (
        (related_patient_id IS NOT NULL AND related_person_id IS NULL)
     OR (related_patient_id IS NULL AND related_person_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_patient_legal_guardians_patient ON patient_legal_guardians(tenant_patient_id);

-- 5. Patient Decision Makers
CREATE TABLE IF NOT EXISTS patient_decision_makers (
    decision_maker_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            TEXT NOT NULL,

    tenant_patient_id    UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),

    -- Exactly one of these two:
    related_patient_id   UUID REFERENCES patients_tenant(tenant_patient_id),
    related_person_id    UUID REFERENCES persons(person_id),

    role                 TEXT NOT NULL, -- e.g. 'HEALTHCARE_PROXY', 'GUARDIAN', 'SURROGATE'
    priority             INTEGER,        -- 1 = primary, 2 = secondary, etc.

    valid_from           DATE NOT NULL,
    valid_to             DATE,

    created_at           TIMESTAMPTZ DEFAULT now(),

    CHECK (
        (related_patient_id IS NOT NULL AND related_person_id IS NULL)
     OR (related_patient_id IS NULL AND related_person_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_patient_decision_makers_patient ON patient_decision_makers(tenant_patient_id);
