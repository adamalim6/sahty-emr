-- Migration 104: Drop details JSONB from prescriptions
-- This migration permanently removes the legacy JSONB details (and its original 'data' name)
-- after the API has been safely decoupled from it.

ALTER TABLE prescriptions DROP COLUMN IF EXISTS details;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS data;
