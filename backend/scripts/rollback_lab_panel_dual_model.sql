-- rollback_lab_panel_dual_model.sql

BEGIN;

DO $$ 
BEGIN

-- Rollback Global Actes
ALTER TABLE public.global_actes DROP CONSTRAINT IF EXISTS chk_global_actes_billing_mode;
ALTER TABLE public.global_actes DROP COLUMN IF EXISTS billing_mode;
ALTER TABLE public.global_actes DROP COLUMN IF EXISTS is_panel;

-- Rollback Lab Panels
ALTER TABLE public.lab_panels DROP CONSTRAINT IF EXISTS fk_lab_panels_global_act;
ALTER TABLE public.lab_panels DROP COLUMN IF EXISTS global_act_id;

-- Rollback Lab Panel Items Constraint Modifications
ALTER TABLE public.lab_panel_items DROP CONSTRAINT IF EXISTS chk_lab_panel_items_type;
ALTER TABLE public.lab_panel_items DROP CONSTRAINT IF EXISTS chk_lab_panel_child_exclusive;
-- Revert back to original exclusive constraint without restricting domain string matching
ALTER TABLE public.lab_panel_items 
    ADD CONSTRAINT chk_lab_panel_child_exclusive 
    CHECK (
        (item_type = 'PANEL'::text AND child_panel_id IS NOT NULL AND child_global_act_id IS NULL) 
        OR 
        (item_type = 'ACT'::text AND child_global_act_id IS NOT NULL AND child_panel_id IS NULL)
    );

-- Rollback Reference Tenant Architecture
ALTER TABLE reference.global_actes DROP CONSTRAINT IF EXISTS chk_ref_global_actes_billing_mode;
ALTER TABLE reference.global_actes DROP COLUMN IF EXISTS billing_mode;
ALTER TABLE reference.global_actes DROP COLUMN IF EXISTS is_panel;

ALTER TABLE reference.lab_panels DROP CONSTRAINT IF EXISTS fk_ref_lab_panels_global_act;
ALTER TABLE reference.lab_panels DROP COLUMN IF EXISTS global_act_id;

ALTER TABLE reference.lab_panel_items DROP CONSTRAINT IF EXISTS chk_ref_lab_panel_items_type;
ALTER TABLE reference.lab_panel_items DROP CONSTRAINT IF EXISTS chk_lab_panel_child_exclusive;

ALTER TABLE reference.lab_panel_items 
    ADD CONSTRAINT chk_lab_panel_child_exclusive 
    CHECK (
        (item_type = 'PANEL'::text AND child_panel_id IS NOT NULL AND child_global_act_id IS NULL) 
        OR 
        (item_type = 'ACT'::text AND child_global_act_id IS NOT NULL AND child_panel_id IS NULL)
    );

END $$;

COMMIT;
