-- =========================
-- CORE MEDICATION / ACT FIELDS
-- =========================

ALTER TABLE prescriptions
ADD COLUMN qty NUMERIC NULL,

ADD COLUMN molecule_id UUID NULL,
ADD COLUMN molecule_name TEXT NULL,

ADD COLUMN product_id UUID NULL,
ADD COLUMN product_name TEXT NULL,

ADD COLUMN acte_id UUID NULL,
ADD COLUMN libelle_sih TEXT NULL,

ADD COLUMN blood_product_type TEXT NULL,

ADD COLUMN unit_id UUID NULL,
ADD COLUMN unit_label TEXT NULL,

ADD COLUMN route_id UUID NULL,
ADD COLUMN route_label TEXT NULL,

ADD COLUMN substitutable BOOLEAN NULL,
ADD COLUMN dilution_required BOOLEAN NULL,

-- =========================
-- SOLVENT
-- =========================

ADD COLUMN solvent_qty NUMERIC NULL,

ADD COLUMN solvent_unit_id UUID NULL,
ADD COLUMN solvent_unit_label TEXT NULL,

ADD COLUMN solvent_molecule_id UUID NULL,
ADD COLUMN solvent_molecule_name TEXT NULL,

ADD COLUMN solvent_product_id UUID NULL,
ADD COLUMN solvent_product_name TEXT NULL,

-- =========================
-- SCHEDULING (COMMON CORE)
-- =========================

ADD COLUMN schedule_mode TEXT NULL,
ADD COLUMN schedule_type TEXT NULL,

ADD COLUMN interval INTEGER NULL,
ADD COLUMN simple_count INTEGER NULL,

ADD COLUMN duration_unit TEXT NULL,
ADD COLUMN duration_value INTEGER NULL,

ADD COLUMN simple_period TEXT NULL,
ADD COLUMN daily_schedule TEXT NULL,

ADD COLUMN selected_days JSONB NULL,
ADD COLUMN specific_times JSONB NULL,

ADD COLUMN start_datetime TIMESTAMP NULL,

ADD COLUMN interval_duration INTEGER NULL,
ADD COLUMN is_custom_interval BOOLEAN NULL,

-- =========================
-- ADMINISTRATION
-- =========================

ADD COLUMN admin_mode TEXT NULL,
ADD COLUMN admin_duration_mins INTEGER NULL,

-- =========================
-- EVENT OVERRIDES (TEMP JSONB)
-- =========================

ADD COLUMN skipped_events JSONB NULL,
ADD COLUMN manually_adjusted_events JSONB NULL;
