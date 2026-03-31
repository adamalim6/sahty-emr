-- 1.1 Drop existing table
DROP TABLE IF EXISTS public.lab_requests CASCADE;

-- 1.2 Recreate clean structure
CREATE TABLE public.lab_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_patient_id uuid NOT NULL,
    admission_id uuid NOT NULL,

    global_act_id uuid NOT NULL,

    prescription_event_id uuid NOT NULL, -- 🔥 CORE FIX

    created_by_user_id uuid,
    created_at timestamp without time zone DEFAULT now()
);

-- 1.3 Add constraints
ALTER TABLE public.lab_requests
ADD CONSTRAINT fk_lab_requests_patient
FOREIGN KEY (tenant_patient_id)
REFERENCES public.patients_tenant(tenant_patient_id)
ON DELETE CASCADE;

ALTER TABLE public.lab_requests
ADD CONSTRAINT fk_lab_requests_admission
FOREIGN KEY (admission_id)
REFERENCES public.admissions(id)
ON DELETE CASCADE;

ALTER TABLE public.lab_requests
ADD CONSTRAINT fk_lab_requests_act
FOREIGN KEY (global_act_id)
REFERENCES reference.global_actes(id);

ALTER TABLE public.lab_requests
ADD CONSTRAINT fk_lab_requests_prescription_event
FOREIGN KEY (prescription_event_id)
REFERENCES public.prescription_events(id)
ON DELETE CASCADE;

-- 1.4 Enforce 1:1 relationship
ALTER TABLE public.lab_requests
ADD CONSTRAINT unique_lab_request_per_event
UNIQUE (prescription_event_id);

-- 1.5 Indexes
CREATE INDEX idx_lab_requests_patient
ON public.lab_requests(tenant_patient_id);

CREATE INDEX idx_lab_requests_admission
ON public.lab_requests(admission_id);

CREATE INDEX idx_lab_requests_event
ON public.lab_requests(prescription_event_id);
