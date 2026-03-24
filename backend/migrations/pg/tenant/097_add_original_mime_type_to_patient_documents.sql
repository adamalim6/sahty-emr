-- Migration: 097_add_original_mime_type_to_patient_documents.sql
-- Description: Add original_mime_type column to patient_documents to preserve origin mime state
-- Context: public schema inside tenant database

BEGIN;

ALTER TABLE public.patient_documents
ADD COLUMN original_mime_type TEXT NULL;

COMMIT;
