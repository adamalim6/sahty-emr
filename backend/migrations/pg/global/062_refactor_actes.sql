-- 1. Global Database Migration (sahty_global)

-- Generic audit trigger function (Added since it was missing in sahty_global)
CREATE OR REPLACE FUNCTION public.fn_generic_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_record_id TEXT;  -- Using TEXT temporarily if tables dont have UUID id yet
    v_parsed_uuid UUID;
    v_changed_by UUID;
BEGIN
    v_tenant_id := COALESCE(
        current_setting('app.tenant_id', true)::uuid,
        NULL
    );
    v_changed_by := COALESCE(
        current_setting('app.user_id', true)::uuid,
        NULL
    );

    IF TG_OP = 'DELETE' THEN
        -- Try to get 'id', fallback to NULL
        BEGIN
            EXECUTE 'SELECT $1.id' INTO v_record_id USING OLD;
        EXCEPTION WHEN OTHERS THEN
            v_record_id := NULL;
        END;
        
        -- Safe cast to UUID if possible
        BEGIN
            v_parsed_uuid := v_record_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_parsed_uuid := '00000000-0000-0000-0000-000000000000'::uuid;
        END;

        INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, old_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_parsed_uuid, 'DELETE', row_to_json(OLD)::jsonb, v_changed_by, txid_current());
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        BEGIN
            EXECUTE 'SELECT $1.id' INTO v_record_id USING NEW;
        EXCEPTION WHEN OTHERS THEN
            v_record_id := NULL;
        END;
        
        BEGIN
            v_parsed_uuid := v_record_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_parsed_uuid := '00000000-0000-0000-0000-000000000000'::uuid;
        END;

        INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, old_data, new_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_parsed_uuid, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_changed_by, txid_current());
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        BEGIN
            EXECUTE 'SELECT $1.id' INTO v_record_id USING NEW;
        EXCEPTION WHEN OTHERS THEN
            v_record_id := NULL;
        END;

        BEGIN
            v_parsed_uuid := v_record_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_parsed_uuid := '00000000-0000-0000-0000-000000000000'::uuid;
        END;

        INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, new_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_parsed_uuid, 'INSERT', row_to_json(NEW)::jsonb, v_changed_by, txid_current());
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 1.3 Normalize SIH Taxonomy
CREATE TABLE IF NOT EXISTS public.sih_familles (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    libelle text not null,
    actif boolean not null default true,
    created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.sih_sous_familles (
    id uuid primary key default gen_random_uuid(),
    famille_id uuid not null references public.sih_familles(id) on delete restrict,
    code text not null,
    libelle text not null,
    actif boolean not null default true,
    created_at timestamptz not null default now(),
    unique (famille_id, code)
);

-- 1.1 Add UUID PK 
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Temporarily drop the PK and convert it to a UNIQUE constraint.
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'global_actes_pkey'
  ) THEN
    ALTER TABLE public.global_actes DROP CONSTRAINT global_actes_pkey CASCADE;
  END IF;
END $$;

ALTER TABLE public.global_actes ADD PRIMARY KEY (id);
ALTER TABLE public.global_actes ADD CONSTRAINT global_actes_code_sih_key UNIQUE (code_sih);

-- 1.2 Add Governance Fields
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS catalog_version integer not null default 1;

-- 1.4 Modify global_actes to Use FK
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS famille_id uuid references public.sih_familles(id) on delete set null;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS sous_famille_id uuid references public.sih_sous_familles(id) on delete set null;

-- 2 BIOLOGY EXTENSIONS
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_grise boolean;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_grise_prescription boolean;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_delai_resultats_heures integer;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_cle_facturation text;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_nombre_b integer;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_nombre_b1 integer;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_nombre_b2 integer;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_nombre_b3 integer;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_nombre_b4 integer;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_instructions_prelevement text;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_commentaire text;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS bio_commentaire_prescription text;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS default_specimen_type text;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS is_lims_enabled boolean default false;
ALTER TABLE public.global_actes ADD COLUMN IF NOT EXISTS lims_template_code text;

-- 3 INITIAL DATA SETUP
INSERT INTO public.sih_familles (code, libelle) VALUES ('BIOLOGIE', 'Biologie') ON CONFLICT (code) DO NOTHING;

-- 5 USE EXISTING AUDIT SYSTEM
-- Ensure trigger is applied to new tables
DROP TRIGGER IF EXISTS audit_sih_familles ON public.sih_familles;
CREATE TRIGGER audit_sih_familles
    AFTER INSERT OR UPDATE OR DELETE ON public.sih_familles
    FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();

DROP TRIGGER IF EXISTS audit_sih_sous_familles ON public.sih_sous_familles;
CREATE TRIGGER audit_sih_sous_familles
    AFTER INSERT OR UPDATE OR DELETE ON public.sih_sous_familles
    FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();

DROP TRIGGER IF EXISTS audit_global_actes ON public.global_actes;
CREATE TRIGGER audit_global_actes
    AFTER INSERT OR UPDATE OR DELETE ON public.global_actes
    FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();
