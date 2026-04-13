-- Migration 113: External Systems & Global Act External Codes
-- Adds integration layer for external system code mappings (e.g. EVM/HPRIM)

-- 1. External Systems registry
CREATE TABLE IF NOT EXISTS public.external_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Global Act ↔ External Code mapping
CREATE TABLE IF NOT EXISTS public.global_act_external_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_act_id UUID NOT NULL,
    external_system_id UUID NOT NULL,
    external_code TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP NULL,
    valid_to TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT fk_global_act
        FOREIGN KEY (global_act_id)
        REFERENCES reference.global_actes(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_external_system
        FOREIGN KEY (external_system_id)
        REFERENCES public.external_systems(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_mapping
        UNIQUE (global_act_id, external_system_id, external_code)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_gact_external_codes_act
ON public.global_act_external_codes(global_act_id);

CREATE INDEX IF NOT EXISTS idx_gact_external_codes_system
ON public.global_act_external_codes(external_system_id);

-- 4. Seed: EVM system
INSERT INTO public.external_systems (code, label)
VALUES ('EVM', 'Eurobio Middleware')
ON CONFLICT (code) DO NOTHING;
