-- Migration 040: Destructive Identity Refactor (Persons Removal & Cleanup)
-- WARNING: This drops tables containing person data. REFERENCE TENANT MUST BE PROTECTED.

-- 1. Drop old relationship/role tables
DROP TABLE IF EXISTS "public"."patient_insurances" CASCADE;
DROP TABLE IF EXISTS "public"."patient_emergency_contacts" CASCADE;
DROP TABLE IF EXISTS "public"."patient_decision_makers" CASCADE;
DROP TABLE IF EXISTS "public"."patient_legal_guardians" CASCADE;
DROP TABLE IF EXISTS "public"."patient_relationships" CASCADE;

-- 2. Drop old document tables
DROP TABLE IF EXISTS "public"."patient_documents" CASCADE;
DROP TABLE IF EXISTS "public"."person_documents" CASCADE;

-- 3. Drop persons table
DROP TABLE IF EXISTS "public"."persons" CASCADE;

-- 4. Drop local identity cache & sync schemas
DROP SCHEMA IF EXISTS "identity" CASCADE;
DROP SCHEMA IF EXISTS "identity_sync" CASCADE;

-- 5. Drop NEW identity tables (if they exist from retry)
DROP TABLE IF EXISTS "public"."identity_ids" CASCADE;
DROP TABLE IF EXISTS "public"."patient_identity_change" CASCADE;
DROP TABLE IF EXISTS "public"."patient_relationship_links" CASCADE;
DROP TABLE IF EXISTS "public"."patient_coverages" CASCADE;
DROP TABLE IF EXISTS "public"."coverage_members" CASCADE;
DROP TABLE IF EXISTS "public"."coverages" CASCADE;

-- 6. Alter patients_tenant table to remove old MPI columns
ALTER TABLE "public"."patients_tenant"
  DROP COLUMN IF EXISTS "master_patient_id",
  DROP COLUMN IF EXISTS "mpi_link_status",
  DROP COLUMN IF EXISTS "medical_record_number";
