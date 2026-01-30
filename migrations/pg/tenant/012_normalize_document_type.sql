-- Migration: Normalize inventory_movements.document_type
-- Date: 2026-01-28
-- 
-- This migration:
-- 1. Migrates existing rows to canonical types
-- 2. Drops the old CHECK constraint
-- 3. Creates new CHECK constraint with only canonical types
--
-- Canonical types:
--   DELIVERY_INJECTION  - quarantine → stock
--   TRANSFER            - internal transfer (pharmacy ↔ department)
--   DISPENSE            - stock → patient/admission sink
--   RETURN_INTERNAL     - ward/patient → pharmacy (replaces RETURN_WARD)
--   RETURN_SUPPLIER     - pharmacy → supplier
--   WASTE
--   DESTRUCTION
--   BORROW_IN
--   BORROW_OUT

-- Step 1: Migrate existing rows to new canonical types
UPDATE inventory_movements SET document_type = 'TRANSFER' WHERE document_type IN ('TRANSFER_OUT', 'TRANSFER_IN', 'REPLENISHMENT');
UPDATE inventory_movements SET document_type = 'RETURN_INTERNAL' WHERE document_type = 'RETURN_WARD';
UPDATE inventory_movements SET document_type = 'DELIVERY_INJECTION' WHERE document_type = 'DELIVERY';

-- Step 2: Drop the old CHECK constraint
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_document_type_check;

-- Step 3: Create new CHECK constraint with only canonical types
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_document_type_check 
CHECK (document_type IN (
    'DELIVERY_INJECTION',
    'TRANSFER',
    'DISPENSE',
    'RETURN_INTERNAL',
    'RETURN_SUPPLIER',
    'WASTE',
    'DESTRUCTION',
    'BORROW_IN',
    'BORROW_OUT'
));
