-- 008_drop_public_users.sql
-- Drop legacy public.users table from tenant DBs
-- All user data now lives in auth.users + auth.credentials + public.user_roles

DROP TABLE IF EXISTS public.users CASCADE;
