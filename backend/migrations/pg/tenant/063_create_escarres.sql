-- Migration 063: Create Escarres 3D tracking tables

CREATE TABLE IF NOT EXISTS "public"."escarres" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tenant_patient_id" UUID NOT NULL REFERENCES "public"."patients_tenant"("tenant_patient_id") ON DELETE CASCADE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "pos_x" DOUBLE PRECISION NOT NULL,
    "pos_y" DOUBLE PRECISION NOT NULL,
    "pos_z" DOUBLE PRECISION NOT NULL,
    "body_side" TEXT,
    "body_region" TEXT
);

CREATE INDEX IF NOT EXISTS idx_escarres_patient ON "public"."escarres"("tenant_id", "tenant_patient_id");
CREATE INDEX IF NOT EXISTS idx_escarres_active ON "public"."escarres"("tenant_id", "tenant_patient_id", "is_active");
CREATE INDEX IF NOT EXISTS idx_escarres_created_at ON "public"."escarres"("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "public"."escarre_snapshots" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "escarre_id" UUID NOT NULL REFERENCES "public"."escarres"("id") ON DELETE RESTRICT,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "recorded_by" UUID,
    "stage" INT NOT NULL CHECK ("stage" IN (1, 2, 3, 4)),
    "length_mm" NUMERIC,
    "width_mm" NUMERIC,
    "depth_mm" NUMERIC,
    "tissue_type" TEXT,
    "exudate_amount" TEXT CHECK ("exudate_amount" IN ('none', 'low', 'moderate', 'heavy')),
    "odor" TEXT CHECK ("odor" IN ('none', 'mild', 'strong')),
    "pain_scale" INT CHECK ("pain_scale" >= 0 AND "pain_scale" <= 10),
    "infection_signs" BOOLEAN,
    "dressing" TEXT,
    "notes" TEXT,
    "photo_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escarre_snapshots_lookup ON "public"."escarre_snapshots"("tenant_id", "escarre_id", "recorded_at" DESC);
