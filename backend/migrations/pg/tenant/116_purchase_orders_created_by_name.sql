-- Migration 116: Add human-readable name columns to purchase_orders and delivery_notes
-- The created_by (uuid) column already exists and holds the user's UUID.
-- We add first/last name columns for display purposes (audit trail, UI labels).

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS created_by_first_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_last_name  TEXT;

ALTER TABLE delivery_notes
    ADD COLUMN IF NOT EXISTS created_by_first_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_last_name  TEXT;
