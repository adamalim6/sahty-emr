-- 011: Drop unit_category from room_types
-- This column is no longer used; room types are flat, not categorized.

ALTER TABLE room_types DROP COLUMN IF EXISTS unit_category;
