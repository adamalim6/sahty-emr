-- Migration 045: Add related_phone to patient_relationship_links
-- Rationale: Store phone numbers for external relationships (guardians, emergency contacts)

ALTER TABLE "public"."patient_relationship_links" 
ADD COLUMN IF NOT EXISTS "related_phone" TEXT;
