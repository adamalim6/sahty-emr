-- 121_ecg_echo_records.sql
-- Tenant migration: ECG and Echocardiography record tables
-- Also extends patient_observations.note_type CHECK to include INTERP_ECG and INTERP_ECHO

BEGIN;

-- ============================================================
-- 1. ECG Records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patient_ecg_records (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    tenant_patient_id           UUID NOT NULL,
    linked_admission_id         UUID NULL,

    exam_date                   DATE NOT NULL,
    exam_time                   TIME NOT NULL,

    -- General
    exam_type                   TEXT NOT NULL DEFAULT 'Repos'
                                    CHECK (exam_type IN ('Repos','Controle','Effort')),
    position                    TEXT NOT NULL DEFAULT 'Decubitus'
                                    CHECK (position IN ('Decubitus','Assis')),
    speed_mm_s                  SMALLINT NOT NULL DEFAULT 25
                                    CHECK (speed_mm_s IN (25, 50)),
    quality                     TEXT NOT NULL DEFAULT 'Bonne'
                                    CHECK (quality IN ('Bonne','Artefacts')),

    -- Rhythm
    rhythm                      TEXT NOT NULL DEFAULT 'Sinusal'
                                    CHECK (rhythm IN ('Sinusal','Atrial','Jonctionnel','Ventriculaire')),
    regularity                  TEXT NOT NULL DEFAULT 'Regulier'
                                    CHECK (regularity IN ('Regulier','Irregulier')),
    p_wave                      TEXT NOT NULL DEFAULT 'Presentes'
                                    CHECK (p_wave IN ('Presentes','Absentes')),
    rhythm_disorders            TEXT[] NOT NULL DEFAULT '{"Aucun"}',
    conduction_disorders        TEXT[] NOT NULL DEFAULT '{"Aucun"}',

    -- Repolarization
    repolarization              TEXT NOT NULL DEFAULT 'Normal'
                                    CHECK (repolarization IN ('Normal','Anomalie')),
    repolarization_details      TEXT[] NOT NULL DEFAULT '{}',

    -- Ischemia / Necrosis
    ischemia                    TEXT NOT NULL DEFAULT 'Aucune'
                                    CHECK (ischemia IN ('Aucune','Presente')),
    ischemia_type               TEXT NULL
                                    CHECK (ischemia_type IS NULL OR ischemia_type IN ('Ischémie','SCA ST+','SCA ST-','Infarctus ancien')),
    ischemia_locations          TEXT[] NOT NULL DEFAULT '{}',

    -- Measured intervals (all nullable – may not be recorded)
    fc_bpm                      SMALLINT NULL,
    pr_ms                       SMALLINT NULL,
    qrs_ms                      SMALLINT NULL,
    qt_ms                       SMALLINT NULL,
    qtc_ms                      SMALLINT NULL,

    -- Axes
    axis_p_deg                  SMALLINT NULL,
    axis_qrs_deg                SMALLINT NULL,
    axis_t_deg                  SMALLINT NULL,

    -- Free text
    other_anomalies             TEXT NULL,

    -- Linked interpretation observation (auto-created on save)
    conclusion_observation_id   UUID NULL,

    -- Metadata
    doctor                      TEXT NULL,
    has_attachment              BOOLEAN NOT NULL DEFAULT FALSE,
    created_by                  UUID NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecg_records_patient
    ON public.patient_ecg_records (tenant_patient_id, exam_date DESC, exam_time DESC);

CREATE INDEX IF NOT EXISTS idx_ecg_records_tenant
    ON public.patient_ecg_records (tenant_id, tenant_patient_id);

-- ============================================================
-- 2. Echo Records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patient_echo_records (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    tenant_patient_id           UUID NOT NULL,
    linked_admission_id         UUID NULL,

    exam_date                   DATE NOT NULL,
    exam_time                   TIME NOT NULL,

    -- General
    exam_type                   TEXT NOT NULL DEFAULT 'ETT'
                                    CHECK (exam_type IN ('ETT','ETO','Stress','POCUS')),
    modalities                  TEXT[] NOT NULL DEFAULT '{}',

    -- Left Ventricle
    fevg_pct                    NUMERIC(5,2) NULL,
    gls_pct                     NUMERIC(5,2) NULL,
    mapse_mm                    NUMERIC(5,2) NULL,
    dtd_vg_mm                   NUMERIC(5,2) NULL,
    dtd_index_mm_m2             NUMERIC(5,2) NULL,
    siv_mm                      NUMERIC(5,2) NULL,
    pp_mm                       NUMERIC(5,2) NULL,
    hvg                         TEXT NOT NULL DEFAULT 'Absente'
                                    CHECK (hvg IN ('Absente','Modérée','Sévère')),

    -- Wall Motion
    trouble_cinetique           BOOLEAN NOT NULL DEFAULT FALSE,
    segments_cinetique          TEXT[] NOT NULL DEFAULT '{}',

    -- Right Ventricle
    tapse_mm                    NUMERIC(5,2) NULL,
    fonction_vd                 TEXT NOT NULL DEFAULT 'Normale'
                                    CHECK (fonction_vd IN ('Normale','Altérée')),
    surface_vd_cm2              NUMERIC(5,2) NULL,

    -- Atria
    og_taille                   TEXT NOT NULL DEFAULT 'Normale'
                                    CHECK (og_taille IN ('Normale','Dilatée')),
    od_taille                   TEXT NOT NULL DEFAULT 'Normale'
                                    CHECK (od_taille IN ('Normale','Dilatée')),

    -- Pressures
    paps_mmhg                   NUMERIC(5,1) NULL,
    vci                         TEXT NOT NULL DEFAULT 'Normale'
                                    CHECK (vci IN ('Normale','Dilatée','Peu Collabable')),

    -- Valves (mitrale, aortique, tricuspide, pulmonaire — each gets 3 columns)
    valve_mitrale_status        TEXT NOT NULL DEFAULT 'Normale'
                                    CHECK (valve_mitrale_status IN ('Normale','Pathologique')),
    valve_mitrale_type          TEXT[] NOT NULL DEFAULT '{}',
    valve_mitrale_severity      TEXT NOT NULL DEFAULT 'Minime'
                                    CHECK (valve_mitrale_severity IN ('Minime','Modérée','Sévère')),

    valve_aortique_status       TEXT NOT NULL DEFAULT 'Normale'
                                    CHECK (valve_aortique_status IN ('Normale','Pathologique')),
    valve_aortique_type         TEXT[] NOT NULL DEFAULT '{}',
    valve_aortique_severity     TEXT NOT NULL DEFAULT 'Minime'
                                    CHECK (valve_aortique_severity IN ('Minime','Modérée','Sévère')),

    valve_tricuspide_status     TEXT NOT NULL DEFAULT 'Normale'
                                    CHECK (valve_tricuspide_status IN ('Normale','Pathologique')),
    valve_tricuspide_type       TEXT[] NOT NULL DEFAULT '{}',
    valve_tricuspide_severity   TEXT NOT NULL DEFAULT 'Minime'
                                    CHECK (valve_tricuspide_severity IN ('Minime','Modérée','Sévère')),

    valve_pulmonaire_status     TEXT NOT NULL DEFAULT 'Normale'
                                    CHECK (valve_pulmonaire_status IN ('Normale','Pathologique')),
    valve_pulmonaire_type       TEXT[] NOT NULL DEFAULT '{}',
    valve_pulmonaire_severity   TEXT NOT NULL DEFAULT 'Minime'
                                    CHECK (valve_pulmonaire_severity IN ('Minime','Modérée','Sévère')),

    -- Other findings
    pericarde                   TEXT NOT NULL DEFAULT 'Sec'
                                    CHECK (pericarde IN ('Sec','Epanchement Minime','Epanchement Modéré','Epanchement Abondant')),
    thrombus                    BOOLEAN NOT NULL DEFAULT FALSE,
    vegetation                  BOOLEAN NOT NULL DEFAULT FALSE,
    autre_anomalie              TEXT NULL,

    -- Linked interpretation observation
    conclusion_observation_id   UUID NULL,

    -- Metadata
    doctor                      TEXT NULL,
    has_attachment              BOOLEAN NOT NULL DEFAULT FALSE,
    created_by                  UUID NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_echo_records_patient
    ON public.patient_echo_records (tenant_patient_id, exam_date DESC, exam_time DESC);

CREATE INDEX IF NOT EXISTS idx_echo_records_tenant
    ON public.patient_echo_records (tenant_id, tenant_patient_id);

-- ============================================================
-- 3. Extend patient_observations.note_type CHECK constraint
--    to include INTERP_ECG and INTERP_ECHO
-- ============================================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name on note_type
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.patient_observations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%note_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.patient_observations DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE public.patient_observations
    ADD CONSTRAINT patient_observations_note_type_check
    CHECK (note_type IN (
        'ADMISSION', 'PROGRESS', 'DISCHARGE', 'CONSULT', 'GENERAL',
        'INTERP_ECG', 'INTERP_ECHO'
    ));

COMMIT;
