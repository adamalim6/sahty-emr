-- 066_laboratory_reference_foundation.sql

BEGIN;

--------------------------------------------------------------------------------
-- 1. LAB SECTIONS (Fixed Classification Layer 1)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sous_famille_id UUID NOT NULL REFERENCES public.sih_sous_familles(id),
    code TEXT NOT NULL,
    libelle TEXT NOT NULL,
    description TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lab_sections_sous_famille_code_key UNIQUE (sous_famille_id, code)
);

CREATE INDEX IF NOT EXISTS idx_lab_sections_sous_famille_id ON public.lab_sections(sous_famille_id);
CREATE INDEX IF NOT EXISTS idx_lab_sections_actif ON public.lab_sections(actif);

--------------------------------------------------------------------------------
-- 2. LAB SUB-SECTIONS (Fixed Classification Layer 2)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_sub_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.lab_sections(id),
    code TEXT NOT NULL,
    libelle TEXT NOT NULL,
    description TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lab_sub_sections_section_id_code_key UNIQUE (section_id, code)
);

CREATE INDEX IF NOT EXISTS idx_lab_sub_sections_section_id ON public.lab_sub_sections(section_id);
CREATE INDEX IF NOT EXISTS idx_lab_sub_sections_actif ON public.lab_sub_sections(actif);

--------------------------------------------------------------------------------
-- 3. LAB PANELS (Recursive Prescribable/Grouping Entities)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sous_famille_id UUID NOT NULL REFERENCES public.sih_sous_familles(id),
    section_id UUID REFERENCES public.lab_sections(id),
    sub_section_id UUID REFERENCES public.lab_sub_sections(id),
    code TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    description TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    is_prescribable BOOLEAN NOT NULL DEFAULT TRUE,
    expand_to_child_tests BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_panels_sous_famille_id ON public.lab_panels(sous_famille_id);
CREATE INDEX IF NOT EXISTS idx_lab_panels_section_id ON public.lab_panels(section_id);
CREATE INDEX IF NOT EXISTS idx_lab_panels_sub_section_id ON public.lab_panels(sub_section_id);
CREATE INDEX IF NOT EXISTS idx_lab_panels_actif ON public.lab_panels(actif);

--------------------------------------------------------------------------------
-- 4. LAB PANEL ITEMS (Recursive Composition)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_panel_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    panel_id UUID NOT NULL REFERENCES public.lab_panels(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('PANEL', 'ACT')),
    child_panel_id UUID REFERENCES public.lab_panels(id),
    child_global_act_id UUID REFERENCES public.global_actes(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    quantity NUMERIC(12,3),
    notes TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_lab_panel_child_exclusive CHECK (
        (item_type = 'PANEL' AND child_panel_id IS NOT NULL AND child_global_act_id IS NULL) OR
        (item_type = 'ACT' AND child_global_act_id IS NOT NULL AND child_panel_id IS NULL)
    ),
    CONSTRAINT chk_lab_panel_no_self_ref CHECK (panel_id != child_panel_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_panel_items_panel_id ON public.lab_panel_items(panel_id);
CREATE INDEX IF NOT EXISTS idx_lab_panel_items_child_panel_id ON public.lab_panel_items(child_panel_id);
CREATE INDEX IF NOT EXISTS idx_lab_panel_items_child_act_id ON public.lab_panel_items(child_global_act_id);

--------------------------------------------------------------------------------
-- 5. LAB SPECIMEN TYPES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_specimen_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    description TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 6. LAB UNITS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    symbole TEXT NOT NULL,
    libelle TEXT NOT NULL,
    ucum_code TEXT,
    description TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 7. LAB ANALYTES (Atomic Structured Result Semantics)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_analytes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sous_famille_id UUID NOT NULL REFERENCES public.sih_sous_familles(id),
    section_id UUID REFERENCES public.lab_sections(id),
    sub_section_id UUID REFERENCES public.lab_sub_sections(id),
    code TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    short_label TEXT,
    description TEXT,
    value_type TEXT NOT NULL CHECK (value_type IN ('NUMERIC', 'TEXT', 'BOOLEAN', 'CHOICE')),
    default_unit_id UUID REFERENCES public.lab_units(id),
    canonical_unit_id UUID REFERENCES public.lab_units(id),
    decimal_precision INTEGER,
    is_calculated BOOLEAN NOT NULL DEFAULT FALSE,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_analytes_sous_famille_id ON public.lab_analytes(sous_famille_id);
CREATE INDEX IF NOT EXISTS idx_lab_analytes_section_id ON public.lab_analytes(section_id);
CREATE INDEX IF NOT EXISTS idx_lab_analytes_sub_section_id ON public.lab_analytes(sub_section_id);
CREATE INDEX IF NOT EXISTS idx_lab_analytes_value_type ON public.lab_analytes(value_type);
CREATE INDEX IF NOT EXISTS idx_lab_analytes_actif ON public.lab_analytes(actif);

--------------------------------------------------------------------------------
-- 8. LAB ACT ANALYTES (Mapping executable biology acts to analytes)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_act_analytes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_act_id UUID NOT NULL REFERENCES public.global_actes(id),
    analyte_id UUID NOT NULL REFERENCES public.lab_analytes(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    result_role TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (result_role IN ('PRIMARY', 'SECONDARY', 'DERIVED', 'CALCULATED', 'AUXILIARY')),
    display_group TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lab_act_analytes_act_analyte_key UNIQUE (global_act_id, analyte_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_act_analytes_global_act_id ON public.lab_act_analytes(global_act_id);
CREATE INDEX IF NOT EXISTS idx_lab_act_analytes_analyte_id ON public.lab_act_analytes(analyte_id);

--------------------------------------------------------------------------------
-- 9. LAB ANALYTE UNITS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_analyte_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyte_id UUID NOT NULL REFERENCES public.lab_analytes(id),
    unit_id UUID NOT NULL REFERENCES public.lab_units(id),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_canonical BOOLEAN NOT NULL DEFAULT FALSE,
    conversion_to_canonical_formula TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lab_analyte_units_analyte_unit_key UNIQUE (analyte_id, unit_id)
);

-- Ensure only one default and one canonical unit per analyte
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_analyte_units_default ON public.lab_analyte_units(analyte_id) WHERE is_default = TRUE AND actif = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_analyte_units_canonical ON public.lab_analyte_units(analyte_id) WHERE is_canonical = TRUE AND actif = TRUE;

--------------------------------------------------------------------------------
-- 10. LAB ANALYTE ALIASES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_analyte_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyte_id UUID NOT NULL REFERENCES public.lab_analytes(id),
    alias_text TEXT NOT NULL,
    alias_type TEXT NOT NULL DEFAULT 'DISPLAY' CHECK (alias_type IN ('DISPLAY', 'OCR', 'EXTERNAL', 'SHORT', 'ABBREVIATION')),
    language_code TEXT,
    source_system TEXT,
    is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lab_analyte_aliases_analyte_alias_type_key UNIQUE (analyte_id, alias_text, alias_type)
);

CREATE INDEX IF NOT EXISTS idx_lab_analyte_aliases_analyte_id ON public.lab_analyte_aliases(analyte_id);
CREATE INDEX IF NOT EXISTS idx_lab_analyte_aliases_alias_text_lower ON public.lab_analyte_aliases(LOWER(alias_text));

--------------------------------------------------------------------------------
-- 11. LAB METHODS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    description TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 12. LAB ACT METHODS (Biology Scope Only)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_act_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_act_id UUID NOT NULL REFERENCES public.global_actes(id),
    method_id UUID NOT NULL REFERENCES public.lab_methods(id),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lab_act_methods_act_method_key UNIQUE (global_act_id, method_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_act_methods_default ON public.lab_act_methods(global_act_id) WHERE is_default = TRUE AND actif = TRUE;

--------------------------------------------------------------------------------
-- 13. LAB ACT SPECIMEN TYPES (Biology Scope Only)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_act_specimen_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_act_id UUID NOT NULL REFERENCES public.global_actes(id),
    specimen_type_id UUID NOT NULL REFERENCES public.lab_specimen_types(id),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    collection_instructions TEXT,
    min_volume NUMERIC(12,3),
    volume_unit TEXT,
    transport_conditions TEXT,
    stability_notes TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lab_act_specimen_types_act_specimen_key UNIQUE (global_act_id, specimen_type_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_act_specimen_types_global_act_id ON public.lab_act_specimen_types(global_act_id);
CREATE INDEX IF NOT EXISTS idx_lab_act_specimen_types_specimen_type_id ON public.lab_act_specimen_types(specimen_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_act_specimen_types_default ON public.lab_act_specimen_types(global_act_id) WHERE is_default = TRUE AND actif = TRUE;

--------------------------------------------------------------------------------
-- 14. LAB ANALYTE REFERENCE RANGES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_analyte_reference_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyte_id UUID NOT NULL REFERENCES public.lab_analytes(id),
    unit_id UUID NOT NULL REFERENCES public.lab_units(id),
    method_id UUID REFERENCES public.lab_methods(id),
    specimen_type_id UUID REFERENCES public.lab_specimen_types(id),
    sex TEXT CHECK (sex IN ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN', 'ANY')),
    age_min_days INTEGER,
    age_max_days INTEGER,
    lower_numeric NUMERIC(18,6),
    upper_numeric NUMERIC(18,6),
    lower_text TEXT,
    upper_text TEXT,
    reference_text TEXT,
    critical_low_numeric NUMERIC(18,6),
    critical_high_numeric NUMERIC(18,6),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_analyte_ref_ranges_analyte_id ON public.lab_analyte_reference_ranges(analyte_id);
CREATE INDEX IF NOT EXISTS idx_lab_analyte_ref_ranges_unit_id ON public.lab_analyte_reference_ranges(unit_id);
CREATE INDEX IF NOT EXISTS idx_lab_analyte_ref_ranges_method_id ON public.lab_analyte_reference_ranges(method_id);
CREATE INDEX IF NOT EXISTS idx_lab_analyte_ref_ranges_specimen_id ON public.lab_analyte_reference_ranges(specimen_type_id);

--------------------------------------------------------------------------------
-- 15. LAB ANALYTE EXTERNAL CODES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_analyte_external_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyte_id UUID NOT NULL REFERENCES public.lab_analytes(id),
    coding_system TEXT NOT NULL,
    code TEXT NOT NULL,
    display_text TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lab_analyte_ext_codes_analyte_sys_code_key UNIQUE (analyte_id, coding_system, code)
);

CREATE INDEX IF NOT EXISTS idx_lab_analyte_ext_codes_analyte_id ON public.lab_analyte_external_codes(analyte_id);
CREATE INDEX IF NOT EXISTS idx_lab_analyte_ext_codes_sys_code ON public.lab_analyte_external_codes(coding_system, code);

--------------------------------------------------------------------------------
-- 16. MODIFICATIONS TO reference.global_actes (Option A implementation)
--------------------------------------------------------------------------------

-- Add new classification columns (Option A)
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS lab_section_id UUID REFERENCES public.lab_sections(id);
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS lab_sub_section_id UUID REFERENCES public.lab_sub_sections(id);

CREATE INDEX IF NOT EXISTS idx_global_actes_lab_section_id ON public.global_actes(lab_section_id);
CREATE INDEX IF NOT EXISTS idx_global_actes_lab_sub_section_id ON public.global_actes(lab_sub_section_id);

-- Explicitly enforce the rule that no sub-section can be provided without a section
ALTER TABLE public.global_actes DROP CONSTRAINT IF EXISTS chk_global_actes_lab_section_hierarchy;
ALTER TABLE public.global_actes ADD CONSTRAINT chk_global_actes_lab_section_hierarchy 
    CHECK (lab_sub_section_id IS NULL OR lab_section_id IS NOT NULL);

-- Drop deprecated columns if they exist. (Checked that they have no critical data bindings)
ALTER TABLE public.global_actes DROP COLUMN IF EXISTS default_specimen_type;
ALTER TABLE public.global_actes DROP COLUMN IF EXISTS lims_template_code;

COMMIT;
