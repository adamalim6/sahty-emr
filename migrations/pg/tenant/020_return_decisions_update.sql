-- Migration: Return Decisions Workflow Updates
-- Date: 2026-02-03
-- 
-- 1. Updates return_receptions to track status (OPEN/CLOSED)
-- 2. Updates inventory_movements to allow RETURN_DECISION
-- 3. Updates return_decision_lines to use requested outcomes (COMMERCIAL, CHARITY, WASTE)

-- Step 1: Add status to return_receptions
ALTER TABLE return_receptions 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN' 
CHECK (status IN ('OPEN', 'CLOSED'));

-- Step 2: Update inventory_movements document_type constraint
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_document_type_check;

ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_document_type_check 
CHECK (document_type IN (
    'DELIVERY_NOTE', 
    'STOCK_RESERVATION', 
    'DISPENSATION', 
    'ADJUSTMENT', 
    'TRANSFER', 
    'RETURN_RECEPTION',
    'RETURN_DECISION' -- NEW
));

-- Step 3: Update return_decision_lines outcome constraint
ALTER TABLE return_decision_lines DROP CONSTRAINT IF EXISTS return_decision_lines_outcome_check;

ALTER TABLE return_decision_lines ADD CONSTRAINT return_decision_lines_outcome_check 
CHECK (outcome IN ('COMMERCIAL', 'CHARITY', 'WASTE'));
