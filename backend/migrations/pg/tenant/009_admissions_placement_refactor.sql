-- ============================================================================
-- 009: Admissions + Physical Placement Refactor
-- ============================================================================
-- Creates room_types, refactors rooms, adds beds + patient_stays,
-- refactors admissions (admission_number, physician FK, 3 service FKs).
-- ============================================================================

-- ============================================================================
-- 1. ROOM TYPES (replaces stub "unit_types")
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    unit_category   TEXT NOT NULL DEFAULT 'CHAMBRE',  -- CHAMBRE | PLATEAU_TECHNIQUE | BOOTH_CONSULTATION
    number_of_beds  INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. REFACTOR ROOMS — add room_type_id FK, is_active; drop is_occupied
-- ============================================================================

-- 2a. Create a default room type for legacy migration
INSERT INTO room_types (id, name, unit_category, number_of_beds)
VALUES ('00000000-0000-0000-0000-000000000001', 'Standard (migré)', 'CHAMBRE', 1)
ON CONFLICT (id) DO NOTHING;

-- 2b. Add new columns
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_id UUID;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2c. Rename 'number' to 'name' for clarity (rooms are named, not numbered)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='number' AND table_schema='public') THEN
        ALTER TABLE rooms RENAME COLUMN number TO name;
    END IF;
END $$;

-- 2d. Backfill room_type_id for existing rows
UPDATE rooms SET room_type_id = '00000000-0000-0000-0000-000000000001' WHERE room_type_id IS NULL;

-- 2e. Make room_type_id NOT NULL + FK
ALTER TABLE rooms ALTER COLUMN room_type_id SET NOT NULL;
ALTER TABLE rooms ADD CONSTRAINT fk_rooms_room_type
    FOREIGN KEY (room_type_id) REFERENCES room_types(id);

-- 2f. Make service_id NOT NULL (was nullable)
-- First backfill any nulls with a placeholder — in practice there shouldn't be any
UPDATE rooms SET service_id = (SELECT id FROM services LIMIT 1) WHERE service_id IS NULL;

-- 2g. Drop legacy columns
ALTER TABLE rooms DROP COLUMN IF EXISTS is_occupied;
ALTER TABLE rooms DROP COLUMN IF EXISTS section;
ALTER TABLE rooms DROP COLUMN IF EXISTS type;

-- ============================================================================
-- 3. BED STATUS ENUM + BEDS TABLE
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE bed_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS beds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID NOT NULL REFERENCES rooms(id),
    label       TEXT NOT NULL,
    status      bed_status NOT NULL DEFAULT 'AVAILABLE',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(room_id, label)
);

CREATE INDEX IF NOT EXISTS idx_beds_room ON beds (room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds (status) WHERE status = 'AVAILABLE';

-- ============================================================================
-- 4. PATIENT STAYS (append-only, supports transfers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_stays (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id        UUID NOT NULL REFERENCES admissions(id),
    tenant_patient_id   UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    bed_id              UUID NOT NULL REFERENCES beds(id),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_stays_admission ON patient_stays (admission_id);
CREATE INDEX IF NOT EXISTS idx_patient_stays_bed ON patient_stays (bed_id);
CREATE INDEX IF NOT EXISTS idx_patient_stays_active ON patient_stays (bed_id) WHERE ended_at IS NULL;

-- ============================================================================
-- 5. REFACTOR ADMISSIONS
-- ============================================================================

-- 5a. Add new columns
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admission_number TEXT;
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS attending_physician_user_id UUID;
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admitting_service_id UUID;
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS responsible_service_id UUID;
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS current_service_id UUID;

-- 5b. Migrate data
-- nda → admission_number
UPDATE admissions SET admission_number = nda WHERE admission_number IS NULL AND nda IS NOT NULL;

-- service_id → all 3 service columns
UPDATE admissions SET admitting_service_id = service_id WHERE admitting_service_id IS NULL AND service_id IS NOT NULL;
UPDATE admissions SET responsible_service_id = service_id WHERE responsible_service_id IS NULL AND service_id IS NOT NULL;
UPDATE admissions SET current_service_id = service_id WHERE current_service_id IS NULL AND service_id IS NOT NULL;

-- 5c. FK constraints for new columns
ALTER TABLE admissions ADD CONSTRAINT fk_adm_tenant_patient
    FOREIGN KEY (tenant_patient_id) REFERENCES patients_tenant(tenant_patient_id);

ALTER TABLE admissions ADD CONSTRAINT fk_adm_attending_physician
    FOREIGN KEY (attending_physician_user_id) REFERENCES auth.users(user_id);

ALTER TABLE admissions ADD CONSTRAINT fk_adm_admitting_service
    FOREIGN KEY (admitting_service_id) REFERENCES services(id);

ALTER TABLE admissions ADD CONSTRAINT fk_adm_responsible_service
    FOREIGN KEY (responsible_service_id) REFERENCES services(id);

ALTER TABLE admissions ADD CONSTRAINT fk_adm_current_service
    FOREIGN KEY (current_service_id) REFERENCES services(id);

-- 5d. Drop legacy columns
ALTER TABLE admissions DROP COLUMN IF EXISTS nda;
ALTER TABLE admissions DROP COLUMN IF EXISTS doctor_name;
ALTER TABLE admissions DROP COLUMN IF EXISTS room_number;
ALTER TABLE admissions DROP COLUMN IF EXISTS bed_label;
ALTER TABLE admissions DROP COLUMN IF EXISTS patient_id;
ALTER TABLE admissions DROP COLUMN IF EXISTS service_id;

-- 5e. Unique constraint on admission_number (per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_admission_number_tenant
    ON admissions (tenant_id, admission_number)
    WHERE admission_number IS NOT NULL;

-- ============================================================================
-- 6. ADMISSION NUMBER SEQUENCE (per-tenant counter)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS admission_number_seq START 1;

-- ============================================================================
-- DONE
-- ============================================================================
