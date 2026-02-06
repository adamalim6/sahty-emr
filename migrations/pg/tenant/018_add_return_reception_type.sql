-- Migration: Add RETURN_RECEPTION to document_type constraint
-- Date: 2026-02-03
-- 
-- This migration adds RETURN_RECEPTION as a canonical document type
-- for tracking stock movements when receiving returns from services.

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_document_type_check;

-- Step 2: Create new CHECK constraint with RETURN_RECEPTION added
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_document_type_check 
CHECK (document_type IN (
    'DELIVERY_INJECTION',
    'TRANSFER',
    'DISPENSE',
    'RETURN_INTERNAL',
    'RETURN_SUPPLIER',
    'RETURN_RECEPTION',  -- NEW: Receiving stock returns from services
    'WASTE',
    'DESTRUCTION',
    'BORROW_IN',
    'BORROW_OUT'
));
