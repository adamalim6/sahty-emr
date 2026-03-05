-- 064_transfusion_schema.sql

-- A) Patient-reserved blood bags table (reception+assignment merged)
CREATE TABLE IF NOT EXISTS public.transfusion_blood_bags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    tenant_patient_id UUID NOT NULL,
    admission_id UUID NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by_user_id UUID NOT NULL,
    received_by_user_first_name VARCHAR(255),
    received_by_user_last_name VARCHAR(255),
    blood_product_code TEXT NOT NULL,
    bag_number TEXT NOT NULL,
    abo_group TEXT NOT NULL,
    rhesus TEXT NOT NULL,
    volume_ml NUMERIC NULL,
    expiry_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'RECEIVED',
    notes TEXT NULL,
    billed_at TIMESTAMPTZ NULL,
    billing_status TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_transfusion_bag_status CHECK (status IN ('RECEIVED', 'ISSUED', 'ADMINISTERED', 'CANCELLED', 'WASTED')),
    CONSTRAINT fk_transfusion_blood_bags_user FOREIGN KEY (received_by_user_id) REFERENCES auth.users(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfusion_bags_tenant_bag ON public.transfusion_blood_bags(tenant_id, bag_number);
CREATE INDEX IF NOT EXISTS idx_transfusion_bags_patient_date ON public.transfusion_blood_bags(tenant_id, tenant_patient_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfusion_bags_status ON public.transfusion_blood_bags(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_transfusion_bags_product ON public.transfusion_blood_bags(tenant_id, blood_product_code);

-- B) Join table linking administration_events to blood bags
CREATE TABLE IF NOT EXISTS public.administration_event_blood_bags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    administration_event_id UUID NOT NULL,
    blood_bag_id UUID NOT NULL,
    qty_bags NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_admin_event_blood_bags_event FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_event_blood_bags_bag FOREIGN KEY (blood_bag_id) REFERENCES public.transfusion_blood_bags(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_event_blood_bags_unique ON public.administration_event_blood_bags(tenant_id, administration_event_id, blood_bag_id);
CREATE INDEX IF NOT EXISTS idx_admin_event_blood_bags_event ON public.administration_event_blood_bags(tenant_id, administration_event_id);
CREATE INDEX IF NOT EXISTS idx_admin_event_blood_bags_bag ON public.administration_event_blood_bags(tenant_id, blood_bag_id);

-- C) Transfusion checks table (per administration event)
CREATE TABLE IF NOT EXISTS public.transfusion_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    administration_event_id UUID NOT NULL UNIQUE,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_by_user_id UUID NOT NULL,
    identity_check_done BOOLEAN NOT NULL DEFAULT false,
    compatibility_check_done BOOLEAN NOT NULL DEFAULT false,
    bedside_double_check_done BOOLEAN NOT NULL DEFAULT false,
    vitals_baseline_done BOOLEAN NOT NULL DEFAULT false,
    notes TEXT NULL,

    CONSTRAINT fk_transfusion_checks_event FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE,
    CONSTRAINT fk_transfusion_checks_user FOREIGN KEY (checked_by_user_id) REFERENCES auth.users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_transfusion_checks_date ON public.transfusion_checks(tenant_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfusion_checks_event ON public.transfusion_checks(tenant_id, administration_event_id);

-- D) Transfusion reactions table
CREATE TABLE IF NOT EXISTS public.transfusion_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    administration_event_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by_user_id UUID NOT NULL,
    reaction_type TEXT NOT NULL,
    severity TEXT NULL,
    description TEXT NULL,
    actions_taken TEXT NULL,

    CONSTRAINT fk_transfusion_reactions_event FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE,
    CONSTRAINT fk_transfusion_reactions_user FOREIGN KEY (recorded_by_user_id) REFERENCES auth.users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_transfusion_reactions_event ON public.transfusion_reactions(tenant_id, administration_event_id);
CREATE INDEX IF NOT EXISTS idx_transfusion_reactions_date ON public.transfusion_reactions(tenant_id, recorded_at DESC);

-- Ensure poche is in the units catalog
INSERT INTO reference.units (id, code, display, is_ucum, is_active)
VALUES (gen_random_uuid(), 'poche', 'Poche(s)', false, true)
ON CONFLICT (code) DO NOTHING;
