-- Migration 035: Insurance Subscriber Entity Linking + Person Documents
-- Extends patient_insurances to properly link subscribers to entities
-- Creates person_documents for non-patient subscriber documents

-- 1. Extend patient_insurances with subscriber columns
ALTER TABLE patient_insurances
  ADD COLUMN IF NOT EXISTS subscriber_type TEXT DEFAULT 'PATIENT',
  ADD COLUMN IF NOT EXISTS subscriber_patient_id UUID,
  ADD COLUMN IF NOT EXISTS subscriber_person_id UUID,
  ADD COLUMN IF NOT EXISTS subscriber_relationship_type TEXT DEFAULT 'SELF';

-- 2. Create person_documents table (mirrors patient_documents but for persons)
CREATE TABLE IF NOT EXISTS person_documents (
  person_document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(person_id),
  document_type_code TEXT NOT NULL,
  document_number TEXT NOT NULL,
  issuing_country_code TEXT DEFAULT 'MA',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
