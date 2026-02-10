-- 005_create_auth_schema.sql
-- Create auth schema in tenant database for tenant-scoped authentication
-- Mirrors group auth DB schema

CREATE SCHEMA IF NOT EXISTS auth;

-- 1) auth.users — identity records
CREATE TABLE IF NOT EXISTS auth.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    inpe TEXT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    master_patient_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) auth.credentials — password storage
CREATE TABLE IF NOT EXISTS auth.credentials (
    credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'bcrypt',
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- 3) auth.user_tenants — multi-tenant membership
CREATE TABLE IF NOT EXISTS auth.user_tenants (
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tenant_id)
);

-- 4) auth.audit_log — auth-related audit trail
CREATE TABLE IF NOT EXISTS auth.audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NULL,
    action TEXT NOT NULL,
    target_user_id UUID NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
