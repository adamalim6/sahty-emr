BEGIN;

-- 🧱 PART 1 — CREATE lab_analyte_contexts

CREATE TABLE public.lab_analyte_contexts (
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

ALTER TABLE public.lab_analyte_contexts ADD FOREIGN KEY (analyte_id) REFERENCES public.lab_analytes(id);
ALTER TABLE public.lab_analyte_contexts ADD FOREIGN KEY (specimen_type_id) REFERENCES public.lab_specimen_types(id);
ALTER TABLE public.lab_analyte_contexts ADD FOREIGN KEY (unit_id) REFERENCES public.units(id);
ALTER TABLE public.lab_analyte_contexts ADD FOREIGN KEY (method_id) REFERENCES public.lab_methods(id);

CREATE UNIQUE INDEX uq_lab_analyte_context
ON public.lab_analyte_contexts (
    analyte_id,
    specimen_type_id,
    unit_id,
    COALESCE(method_id, '00000000-0000-0000-0000-000000000000')
);

CREATE UNIQUE INDEX uq_context_default
ON public.lab_analyte_contexts (analyte_id, specimen_type_id)
WHERE is_default = true;

CREATE OR REPLACE FUNCTION public.sync_lab_analyte_context_labels()
RETURNS trigger AS $$
BEGIN
    SELECT libelle INTO NEW.analyte_label FROM lab_analytes WHERE id = NEW.analyte_id;
    SELECT libelle INTO NEW.specimen_label FROM lab_specimen_types WHERE id = NEW.specimen_type_id;
    SELECT display INTO NEW.unit_label FROM units WHERE id = NEW.unit_id;

    IF NEW.method_id IS NOT NULL THEN
        SELECT libelle INTO NEW.method_label FROM lab_methods WHERE id = NEW.method_id;
    ELSE
        NEW.method_label := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_context_labels
BEFORE INSERT OR UPDATE ON public.lab_analyte_contexts
FOR EACH ROW
EXECUTE FUNCTION public.sync_lab_analyte_context_labels();


-- 🧱 PART 2 — CREATE lab_act_contexts

CREATE TABLE public.lab_act_contexts (
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

ALTER TABLE public.lab_act_contexts ADD FOREIGN KEY (global_act_id) REFERENCES public.global_actes(id);
ALTER TABLE public.lab_act_contexts ADD FOREIGN KEY (analyte_context_id) REFERENCES public.lab_analyte_contexts(id);

CREATE UNIQUE INDEX uq_act_context
ON public.lab_act_contexts (global_act_id, analyte_context_id);

CREATE UNIQUE INDEX uq_act_default_context
ON public.lab_act_contexts (global_act_id)
WHERE is_default = true;


-- 🧱 PART 5 — DATA BACKFILL GLOBAL

-- Step 1 — Generate contexts
WITH contexts AS (
    SELECT DISTINCT 
        laa.analyte_id,
        last.specimen_type_id,
        COALESCE(
            la.default_unit_id, 
            la.canonical_unit_id, 
            (SELECT id FROM public.units ORDER BY code='-' DESC LIMIT 1) 
        ) as unit_id,
        lam.method_id
    FROM public.lab_act_analytes laa
    JOIN public.lab_act_specimen_types last ON last.global_act_id = laa.global_act_id
    LEFT JOIN public.lab_act_methods lam ON lam.global_act_id = laa.global_act_id
    JOIN public.lab_analytes la ON la.id = laa.analyte_id
)
INSERT INTO public.lab_analyte_contexts (
    analyte_id, specimen_type_id, unit_id, method_id, is_default, actif
)
SELECT 
    analyte_id, 
    specimen_type_id, 
    unit_id, 
    method_id,
    (ROW_NUMBER() OVER(PARTITION BY analyte_id, specimen_type_id ORDER BY method_id NULLS FIRST) = 1) as is_default,
    true as actif
FROM contexts
ON CONFLICT (analyte_id, specimen_type_id, unit_id, COALESCE(method_id, '00000000-0000-0000-0000-000000000000')) DO NOTHING;


-- Step 2 — Link ACTs
INSERT INTO public.lab_act_contexts (
    global_act_id, analyte_context_id, sort_order, is_required, is_default, display_group, actif
)
SELECT DISTINCT ON (laa.global_act_id, lac.id)
    laa.global_act_id,
    lac.id as analyte_context_id,
    laa.sort_order,
    laa.is_required,
    (ROW_NUMBER() OVER(PARTITION BY laa.global_act_id ORDER BY laa.sort_order NULLS LAST) = 1) as is_default,
    laa.display_group,
    laa.actif
FROM public.lab_act_analytes laa
JOIN public.lab_act_specimen_types last ON last.global_act_id = laa.global_act_id
LEFT JOIN public.lab_act_methods lam ON lam.global_act_id = laa.global_act_id
JOIN public.lab_analyte_contexts lac ON 
    lac.analyte_id = laa.analyte_id 
    AND lac.specimen_type_id = last.specimen_type_id
    AND (lac.method_id = lam.method_id OR (lac.method_id IS NULL AND lam.method_id IS NULL))
ON CONFLICT (global_act_id, analyte_context_id) DO NOTHING;

COMMIT;
