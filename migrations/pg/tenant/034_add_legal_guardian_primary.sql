-- Migration: Add is_primary column to patient_legal_guardians
ALTER TABLE patient_legal_guardians 
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
