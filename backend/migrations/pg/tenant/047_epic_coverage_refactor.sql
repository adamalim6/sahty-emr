-- 047_epic_coverage_refactor.sql

-- 1. Destructive Cleanup
DROP TABLE IF EXISTS admission_coverage_change_history CASCADE;
DROP TABLE IF EXISTS admission_coverage_members CASCADE;
DROP TABLE IF EXISTS admission_coverages CASCADE;
DROP TABLE IF EXISTS coverage_change_history CASCADE;
DROP TABLE IF EXISTS patient_coverage CASCADE;

-- 2. Coverage Change History (Audit Log for Master Tables)
CREATE TABLE coverage_change_history (
  change_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL,

  coverage_id            uuid NOT NULL,
  coverage_member_id     uuid NULL,  -- NULL = coverage-level change

  change_type_code       text NOT NULL,
  -- Examples: 'CREATE_COVERAGE', 'CHANGE_PAYOR', 'ADD_MEMBER', 'REMOVE_MEMBER'

  field_name             text NULL,
  old_value              text NULL,
  new_value              text NULL,

  change_source          text NOT NULL,  -- 'USER_UI', 'SYSTEM', 'SYNC', 'IMPORT'
  changed_by_user_id     uuid NULL,
  change_reason          text NULL,

  changed_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coverage_history_coverage ON coverage_change_history (tenant_id, coverage_id);
CREATE INDEX idx_coverage_history_member ON coverage_change_history (tenant_id, coverage_member_id);
CREATE INDEX idx_coverage_history_date ON coverage_change_history (tenant_id, changed_at DESC);

-- 3. Admission Snapshot Tables

-- 3.1 admission_coverages
CREATE TABLE admission_coverages (
  admission_coverage_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  admission_id            uuid NOT NULL REFERENCES admissions(id), -- FK changed to id

  coverage_id             uuid NOT NULL REFERENCES coverages(coverage_id), -- Reference only

  filing_order            integer NOT NULL, -- 1 = primary, 2 = secondary

  -- Snapshot of key billing fields
  organisme_id            uuid NOT NULL,
  policy_number           text NULL,
  group_number            text NULL,
  plan_name               text NULL,
  coverage_type_code      text NULL,

  -- Snapshot of subscriber identity
  subscriber_first_name   text NULL,
  subscriber_last_name    text NULL,
  subscriber_identity_type text NULL,
  subscriber_identity_value text NULL,
  subscriber_issuing_country text NULL,

  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adm_cov_admission ON admission_coverages (tenant_id, admission_id);
CREATE INDEX idx_adm_cov_coverage ON admission_coverages (tenant_id, coverage_id);
CREATE UNIQUE INDEX idx_adm_cov_order ON admission_coverages (tenant_id, admission_id, filing_order);

-- 3.2 admission_coverage_members
CREATE TABLE admission_coverage_members (
  admission_coverage_member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    uuid NOT NULL,

  admission_coverage_id        uuid NOT NULL REFERENCES admission_coverages(admission_coverage_id) ON DELETE CASCADE,

  -- Optional link to patient
  tenant_patient_id            uuid NULL, -- No FK constraint to allow for hard decoupling if needed, or keeping it loose

  -- Snapshot of member identity
  member_first_name            text NULL,
  member_last_name             text NULL,
  relationship_to_subscriber_code text NULL,
  member_identity_type         text NULL,
  member_identity_value        text NULL,
  member_issuing_country       text NULL,

  created_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adm_mem_coverage ON admission_coverage_members (tenant_id, admission_coverage_id);
CREATE INDEX idx_adm_mem_patient ON admission_coverage_members (tenant_id, tenant_patient_id);

-- 4. Admission Coverage Change History
CREATE TABLE admission_coverage_change_history (
  change_id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                      uuid NOT NULL,

  admission_id                   uuid NOT NULL,
  admission_coverage_id          uuid NULL,
  admission_coverage_member_id   uuid NULL,

  change_type_code               text NOT NULL,

  field_name                     text NULL,
  old_value                      text NULL,
  new_value                      text NULL,

  change_source                  text NOT NULL,
  changed_by_user_id             uuid NULL,
  change_reason                  text NULL,

  changed_at                     timestamptz NOT NULL DEFAULT now(),

  CHECK (
    admission_coverage_id IS NOT NULL
    OR admission_coverage_member_id IS NOT NULL
  )
);

CREATE INDEX idx_adm_hist_admission ON admission_coverage_change_history (tenant_id, admission_id);
CREATE INDEX idx_adm_hist_coverage ON admission_coverage_change_history (tenant_id, admission_coverage_id);
CREATE INDEX idx_adm_hist_date ON admission_coverage_change_history (tenant_id, changed_at DESC);
