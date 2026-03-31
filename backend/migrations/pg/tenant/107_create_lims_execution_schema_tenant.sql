-- 107_create_lims_execution_schema_tenant.sql
-- Description: Creates the core LIMS execution schema tables for handling atomic requests, collections, specimens, and universal admission acts.

BEGIN;

-- 1) public.lab_requests (Atomic requested test)
CREATE TABLE IF NOT EXISTS public.lab_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_patient_id UUID NOT NULL,
  admission_id UUID NULL,

  global_act_id UUID NOT NULL,
  prescription_id UUID NULL,

  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT fk_lab_requests_admission FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE SET NULL,
  CONSTRAINT fk_lab_requests_prescription FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lab_requests_tenant_patient_id ON public.lab_requests(tenant_patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_requests_admission_id ON public.lab_requests(admission_id);
CREATE INDEX IF NOT EXISTS idx_lab_requests_prescription_id ON public.lab_requests(prescription_id);
CREATE INDEX IF NOT EXISTS idx_lab_requests_global_act_id ON public.lab_requests(global_act_id);

-- 2) public.lab_collections (Collection event/venipuncture)
CREATE TABLE IF NOT EXISTS public.lab_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_patient_id UUID NOT NULL,
  admission_id UUID NULL,

  collected_by_user_id UUID NOT NULL,
  collected_at TIMESTAMP NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_collections_tenant_patient_id ON public.lab_collections(tenant_patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_collections_admission_id ON public.lab_collections(admission_id);

-- 3) public.administration_event_lab_collections (Bridge between MAR and collection)
CREATE TABLE IF NOT EXISTS public.administration_event_lab_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  administration_event_id UUID NOT NULL,
  lab_collection_id UUID NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT now(),

  UNIQUE (administration_event_id, lab_collection_id),

  CONSTRAINT fk_aelc_admin_event FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_aelc_lab_collection FOREIGN KEY (lab_collection_id) REFERENCES public.lab_collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_event_lab_collections_admin_event_id ON public.administration_event_lab_collections(administration_event_id);
CREATE INDEX IF NOT EXISTS idx_admin_event_lab_collections_collection_id ON public.administration_event_lab_collections(lab_collection_id);

-- 4) public.lab_specimens (Physical specimen)
CREATE TABLE IF NOT EXISTS public.lab_specimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  lab_specimen_container_type_id UUID NOT NULL,

  barcode TEXT UNIQUE,

  created_by_user_id UUID NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 5) public.lab_collection_specimens (Bridge from collection to specimens)
CREATE TABLE IF NOT EXISTS public.lab_collection_specimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  lab_collection_id UUID NOT NULL,
  specimen_id UUID NOT NULL,

  UNIQUE (lab_collection_id, specimen_id),

  CONSTRAINT fk_lcs_collection FOREIGN KEY (lab_collection_id) REFERENCES public.lab_collections(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcs_specimen FOREIGN KEY (specimen_id) REFERENCES public.lab_specimens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lab_collection_specimens_collection_id ON public.lab_collection_specimens(lab_collection_id);
CREATE INDEX IF NOT EXISTS idx_lab_collection_specimens_specimen_id ON public.lab_collection_specimens(specimen_id);

-- 6) public.lab_specimen_requests (Bridge from specimen to atomic lab request)
CREATE TABLE IF NOT EXISTS public.lab_specimen_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  specimen_id UUID NOT NULL,
  lab_request_id UUID NOT NULL,

  UNIQUE (specimen_id, lab_request_id),

  CONSTRAINT fk_lsr_specimen FOREIGN KEY (specimen_id) REFERENCES public.lab_specimens(id) ON DELETE CASCADE,
  CONSTRAINT fk_lsr_request FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lab_specimen_requests_specimen_id ON public.lab_specimen_requests(specimen_id);
CREATE INDEX IF NOT EXISTS idx_lab_specimen_requests_lab_request_id ON public.lab_specimen_requests(lab_request_id);

-- 7) public.admission_acts (Universal act / billing entity)
CREATE TABLE IF NOT EXISTS public.admission_acts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  admission_id UUID NOT NULL,
  global_act_id UUID NOT NULL,

  lab_request_id UUID NULL,

  quantity NUMERIC NOT NULL DEFAULT 1,

  entered_in_error_at TIMESTAMP NULL,
  entered_in_error_by UUID NULL,
  entered_in_error_reason TEXT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT fk_admission_acts_admission FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_admission_acts_request FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admission_acts_admission_id ON public.admission_acts(admission_id);
CREATE INDEX IF NOT EXISTS idx_admission_acts_lab_request_id ON public.admission_acts(lab_request_id);
CREATE INDEX IF NOT EXISTS idx_admission_acts_global_act_id ON public.admission_acts(global_act_id);

COMMIT;
