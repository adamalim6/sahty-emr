
-- 000_init.sql: Restored Base Schema for Tenant Provisioning
-- Contains the initial state of 'patients_tenant', 'patient_addresses' etc. as required by 002+ migrations.

CREATE TABLE IF NOT EXISTS public.patients_tenant (
    tenant_patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    global_patient_id UUID, -- Legacy column, dropped in 003
    medical_record_number TEXT,
    status TEXT, -- ACTIVE, MERGED, INACTIVE
    nationality_id UUID,
    
    -- Original columns present in 3f6d before 002
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.patient_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_patient_id UUID NOT NULL REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    address_line TEXT,
    city TEXT,
    country_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.locations (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    scope TEXT,
    location_class TEXT,
    valuation_policy TEXT,
    service_id UUID,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add other tables if 001/002 depend on them.
-- 002 refactors patients_tenant and patient_addresses.
-- 001 creates identity schema (independent).
-- So this minimal set should suffice for Simulate Provisioning to verify 001-004 flow.
