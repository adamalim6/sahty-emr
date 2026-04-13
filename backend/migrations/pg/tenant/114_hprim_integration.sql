-- Migration 114: HPRIM Integration Infrastructure
-- Creates tracking, bridging, and mapping tables for HPRIM/EVM file-based integration.

-- ============================================================
-- 1. lab_hprim_messages — Full audit trail of HPRIM exchanges
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lab_hprim_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direction TEXT NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
    message_type TEXT NOT NULL CHECK (message_type IN ('ORM', 'ORU')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    ok_file_name TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'WRITTEN', 'PROCESSED', 'ERROR')),
    payload_text TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_lab_hprim_messages_direction ON public.lab_hprim_messages (direction);
CREATE INDEX IF NOT EXISTS idx_lab_hprim_messages_message_type ON public.lab_hprim_messages (message_type);
CREATE INDEX IF NOT EXISTS idx_lab_hprim_messages_status ON public.lab_hprim_messages (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_hprim_messages_file_name ON public.lab_hprim_messages (file_name);

-- ============================================================
-- 2. lab_hprim_links — Bridge internal IDs ↔ HPRIM order/sample IDs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lab_hprim_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hprim_message_id UUID NOT NULL REFERENCES public.lab_hprim_messages(id),
    lab_request_id UUID NOT NULL REFERENCES public.lab_requests(id),
    lab_specimen_id UUID REFERENCES public.lab_specimens(id),
    hprim_order_id TEXT NOT NULL,
    hprim_sample_id TEXT,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_hprim_links_order_id ON public.lab_hprim_links (hprim_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_hprim_links_message ON public.lab_hprim_links (hprim_message_id);
CREATE INDEX IF NOT EXISTS idx_lab_hprim_links_request ON public.lab_hprim_links (lab_request_id);

-- ============================================================
-- 3. lab_analyte_external_codes — Maps EVM analyte codes to internal analytes
--    Replaces reference.lab_analyte_external_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lab_analyte_external_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyte_id UUID NOT NULL,
    external_system_id UUID NOT NULL REFERENCES public.external_systems(id),
    external_code TEXT NOT NULL,
    external_label TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_analyte_ext_codes_unique
    ON public.lab_analyte_external_codes (analyte_id, external_system_id, external_code);
CREATE INDEX IF NOT EXISTS idx_lab_analyte_ext_codes_system
    ON public.lab_analyte_external_codes (external_system_id);
CREATE INDEX IF NOT EXISTS idx_lab_analyte_ext_codes_code
    ON public.lab_analyte_external_codes (external_code, external_system_id);

-- ============================================================
-- 4. lab_unit_external_codes — Maps EVM unit codes to internal units
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lab_unit_external_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    external_system_id UUID NOT NULL REFERENCES public.external_systems(id),
    external_code TEXT NOT NULL,
    external_label TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_unit_ext_codes_unique
    ON public.lab_unit_external_codes (unit_id, external_system_id, external_code);
CREATE INDEX IF NOT EXISTS idx_lab_unit_ext_codes_system
    ON public.lab_unit_external_codes (external_system_id);
CREATE INDEX IF NOT EXISTS idx_lab_unit_ext_codes_code
    ON public.lab_unit_external_codes (external_code, external_system_id);

-- ============================================================
-- 5. Drop old reference.lab_analyte_external_codes
-- ============================================================
DROP TABLE IF EXISTS reference.lab_analyte_external_codes;

-- ============================================================
-- 6. Seed dummy EVM external codes for all biology acts
--    Uses code_sih as the external code.
--    Only seeds if EVM system exists.
-- ============================================================
INSERT INTO public.global_act_external_codes (
    global_act_id, external_system_id, external_code, is_active
)
SELECT
    ga.id,
    es.id,
    ga.code_sih,
    TRUE
FROM reference.global_actes ga
JOIN reference.sih_familles f ON f.id = ga.famille_id
CROSS JOIN public.external_systems es
WHERE f.libelle = 'Biologie'
  AND es.code = 'EVM'
  AND ga.code_sih IS NOT NULL
  AND ga.code_sih != ''
ON CONFLICT DO NOTHING;
