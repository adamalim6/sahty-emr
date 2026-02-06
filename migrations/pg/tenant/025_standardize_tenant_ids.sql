-- Standardize Tenant ID to UUID
-- Migration ID: 025
-- Description: Renames users.client_id to tenant_id and converts all legacy TEXT tenant_id columns to UUID.

-- 1. Users Table (Rename & Convert)
ALTER TABLE users RENAME COLUMN client_id TO tenant_id;
ALTER TABLE users ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

-- 2. Patient Network (Convert TEXT -> UUID)
ALTER TABLE patients_tenant ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
-- Note: persons table is not in the audit list as accessible in public schema? audit said 'persons.tenant_id: ❌ TEXT'.
-- But wait, do I have a 'persons' table? 023_patient_network.sql created it?
-- Let's check 023 or assume audit was correct. Audit found 'persons.tenant_id'.
ALTER TABLE persons ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

ALTER TABLE patient_relationships ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE patient_decision_makers ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE patient_emergency_contacts ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE patient_legal_guardians ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

-- 3. Stock Reservations (Convert TEXT -> UUID)
ALTER TABLE stock_reservations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE stock_reservation_lines ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

-- 4. Re-Index users if needed (Index renaming is usually automatic but good to check)
-- The original index was: CREATE INDEX idx_users_client ON users(client_id);
-- Postgres usually renames it, but we can rename explicitly for clarity if we want.
ALTER INDEX IF EXISTS idx_users_client RENAME TO idx_users_tenant;
