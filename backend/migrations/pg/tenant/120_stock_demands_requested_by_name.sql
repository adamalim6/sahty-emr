-- Migration 120: Add human-readable name columns to stock_demands for Demandeur display.

ALTER TABLE stock_demands
  ADD COLUMN IF NOT EXISTS requested_by_first_name TEXT,
  ADD COLUMN IF NOT EXISTS requested_by_last_name TEXT;
