-- 086_lab_panel_dual_model_tenant.sql

BEGIN;

--------------------------------------------------------------------------------
-- 1. MODIFY reference.global_actes
--------------------------------------------------------------------------------
ALTER TABLE reference.global_actes 
    ADD COLUMN IF NOT EXISTS is_panel BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'DECOMPOSED';

ALTER TABLE reference.global_actes 
    DROP CONSTRAINT IF EXISTS chk_ref_global_actes_billing_mode;

ALTER TABLE reference.global_actes 
    ADD CONSTRAINT chk_ref_global_actes_billing_mode 
    CHECK (billing_mode IN ('PANEL', 'DECOMPOSED'));

--------------------------------------------------------------------------------
-- 2. MODIFY reference.lab_panels
--------------------------------------------------------------------------------
ALTER TABLE reference.lab_panels 
    ADD COLUMN IF NOT EXISTS global_act_id UUID NOT NULL UNIQUE;

ALTER TABLE reference.lab_panels 
    DROP CONSTRAINT IF EXISTS fk_ref_lab_panels_global_act;

ALTER TABLE reference.lab_panels 
    ADD CONSTRAINT fk_ref_lab_panels_global_act 
    FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id) ON DELETE RESTRICT;

--------------------------------------------------------------------------------
-- 3. MODIFY reference.lab_panel_items
--------------------------------------------------------------------------------
ALTER TABLE reference.lab_panel_items 
    DROP CONSTRAINT IF EXISTS chk_lab_panel_child_exclusive;

ALTER TABLE reference.lab_panel_items 
    DROP CONSTRAINT IF EXISTS chk_ref_lab_panel_items_type;

ALTER TABLE reference.lab_panel_items
    ADD CONSTRAINT chk_ref_lab_panel_items_type
    CHECK (item_type IN ('ACT', 'PANEL'));

ALTER TABLE reference.lab_panel_items 
    ADD CONSTRAINT chk_lab_panel_child_exclusive 
    CHECK (
        (item_type = 'ACT' AND child_global_act_id IS NOT NULL AND child_panel_id IS NULL)
        OR
        (item_type = 'PANEL' AND child_panel_id IS NOT NULL AND child_global_act_id IS NULL)
    );

COMMIT;
