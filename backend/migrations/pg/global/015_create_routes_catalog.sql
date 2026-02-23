-- ==========================================
-- 015_create_routes_catalog.sql -- sahty_global
-- ==========================================

CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routes_active_order ON public.routes (is_active, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_sort_order_unique ON public.routes (sort_order);

-- Seed Initial Data (based on standard EMR prescription routes)
INSERT INTO public.routes (id, code, label, sort_order) VALUES
(gen_random_uuid(), 'ORAL', 'Orale', 10),
(gen_random_uuid(), 'IV', 'Intraveineuse (IV)', 20),
(gen_random_uuid(), 'IVD', 'Intraveineuse directe (IVD)', 30),
(gen_random_uuid(), 'IVL', 'Intraveineuse lente (IVL)', 40),
(gen_random_uuid(), 'SC', 'Sous-cutanée (SC)', 50),
(gen_random_uuid(), 'IM', 'Intramusculaire (IM)', 60),
(gen_random_uuid(), 'SUBLINGUAL', 'Sublinguale', 70),
(gen_random_uuid(), 'RECTAL', 'Rectale', 80),
(gen_random_uuid(), 'TOPICAL', 'Cutanée (Locale)', 90),
(gen_random_uuid(), 'INHALATION', 'Inhalation', 100),
(gen_random_uuid(), 'OCULAR', 'Ophtalmique', 110),
(gen_random_uuid(), 'AURAL', 'Auriculaire', 120),
(gen_random_uuid(), 'NASAL', 'Nasale', 130),
(gen_random_uuid(), 'VAGINAL', 'Vaginale', 140),
(gen_random_uuid(), 'EPIDURAL', 'Péridurale', 150)
ON CONFLICT (code) DO NOTHING;
