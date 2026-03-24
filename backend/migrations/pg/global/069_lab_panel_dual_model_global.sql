-- 069_lab_panel_dual_model_global.sql

BEGIN;

--------------------------------------------------------------------------------
-- 1. MODIFY global_actes
--------------------------------------------------------------------------------
ALTER TABLE public.global_actes 
    ADD COLUMN IF NOT EXISTS is_panel BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'DECOMPOSED';

ALTER TABLE public.global_actes 
    DROP CONSTRAINT IF EXISTS chk_global_actes_billing_mode;

ALTER TABLE public.global_actes 
    ADD CONSTRAINT chk_global_actes_billing_mode 
    CHECK (billing_mode IN ('PANEL', 'DECOMPOSED'));

--------------------------------------------------------------------------------
-- 2. MODIFY lab_panels
--------------------------------------------------------------------------------
-- Add column with NOT NULL and UNIQUE constraint
ALTER TABLE public.lab_panels 
    ADD COLUMN IF NOT EXISTS global_act_id UUID NOT NULL UNIQUE;

-- Add Foreign Key
ALTER TABLE public.lab_panels 
    DROP CONSTRAINT IF EXISTS fk_lab_panels_global_act;

ALTER TABLE public.lab_panels 
    ADD CONSTRAINT fk_lab_panels_global_act 
    FOREIGN KEY (global_act_id) REFERENCES public.global_actes(id) ON DELETE RESTRICT;

--------------------------------------------------------------------------------
-- 3. MODIFY lab_panel_items
--------------------------------------------------------------------------------
-- Replace existing exclusive check if any, to enforce strict structure and item_type domain
ALTER TABLE public.lab_panel_items 
    DROP CONSTRAINT IF EXISTS chk_lab_panel_child_exclusive;

ALTER TABLE public.lab_panel_items 
    DROP CONSTRAINT IF EXISTS chk_lab_panel_items_type;

ALTER TABLE public.lab_panel_items
    ADD CONSTRAINT chk_lab_panel_items_type
    CHECK (item_type IN ('ACT', 'PANEL'));

ALTER TABLE public.lab_panel_items 
    ADD CONSTRAINT chk_lab_panel_child_exclusive 
    CHECK (
        (item_type = 'ACT' AND child_global_act_id IS NOT NULL AND child_panel_id IS NULL)
        OR
        (item_type = 'PANEL' AND child_panel_id IS NOT NULL AND child_global_act_id IS NULL)
    );

COMMIT;
