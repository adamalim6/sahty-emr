-- Remove Legacy public.roles Table
-- Migration ID: 027
-- Description: Drops the redundant public.roles table.
--              Roles are now served exclusively from reference.global_roles
--              (replicated from sahty_global.public.global_roles during provisioning).

-- Safety: No FK constraints reference public.roles.
-- users.role_id is a UUID stored as-is, not enforced by FK.

DROP TABLE IF EXISTS public.roles;
