-- 007_auth_users_add_user_type_service_ids.sql
-- Add user_type and service_ids columns to auth.users
-- These were previously stored only in public.users

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS service_ids JSONB NULL;
