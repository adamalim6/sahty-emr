-- 006_create_user_roles.sql
-- Role assignment table in tenant DB, replacing the embedded role_id in public.users

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles (role_id);
