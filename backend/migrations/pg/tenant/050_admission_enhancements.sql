-- Add admission_type, arrival_mode, provenance to admissions table

ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS admission_type TEXT,
ADD COLUMN IF NOT EXISTS arrival_mode TEXT,
ADD COLUMN IF NOT EXISTS provenance TEXT;

-- Update the baseline schema index if needed, or just let the baseline be updated separately.
-- We will update baseline_tenant_schema.sql manually to reflect this.
