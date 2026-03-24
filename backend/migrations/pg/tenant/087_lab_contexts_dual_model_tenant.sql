BEGIN;

-- 🧱 PART 1 — CREATE lab_analyte_contexts

CREATE TABLE reference.lab_analyte_contexts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    analyte_id uuid NOT NULL,
    specimen_type_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    method_id uuid NULL,

    -- denormalized cache (performance)
    analyte_label text NOT NULL,
    specimen_label text NOT NULL,
    unit_label text NOT NULL,
    method_label text NULL,

    -- flags
    is_default boolean DEFAULT false,
    actif boolean DEFAULT true,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE reference.lab_analyte_contexts ADD FOREIGN KEY (analyte_id) REFERENCES reference.lab_analytes(id);
ALTER TABLE reference.lab_analyte_contexts ADD FOREIGN KEY (specimen_type_id) REFERENCES reference.lab_specimen_types(id);
ALTER TABLE reference.lab_analyte_contexts ADD FOREIGN KEY (unit_id) REFERENCES reference.units(id);
ALTER TABLE reference.lab_analyte_contexts ADD FOREIGN KEY (method_id) REFERENCES reference.lab_methods(id);

CREATE UNIQUE INDEX uq_ref_lab_analyte_context
ON reference.lab_analyte_contexts (
    analyte_id,
    specimen_type_id,
    unit_id,
    COALESCE(method_id, '00000000-0000-0000-0000-000000000000')
);

CREATE UNIQUE INDEX uq_ref_context_default
ON reference.lab_analyte_contexts (analyte_id, specimen_type_id)
WHERE is_default = true;


-- 🧱 PART 2 — CREATE lab_act_contexts

CREATE TABLE reference.lab_act_contexts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    global_act_id uuid NOT NULL,
    analyte_context_id uuid NOT NULL,

    sort_order integer,
    is_required boolean DEFAULT true,
    is_default boolean DEFAULT false,
    display_group text,

    actif boolean DEFAULT true,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE reference.lab_act_contexts ADD FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id);
ALTER TABLE reference.lab_act_contexts ADD FOREIGN KEY (analyte_context_id) REFERENCES reference.lab_analyte_contexts(id);

CREATE UNIQUE INDEX uq_ref_act_context
ON reference.lab_act_contexts (global_act_id, analyte_context_id);

CREATE UNIQUE INDEX uq_ref_act_default_context
ON reference.lab_act_contexts (global_act_id)
WHERE is_default = true;

COMMIT;
