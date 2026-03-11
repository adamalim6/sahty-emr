export interface PatientObservation {
    id: string;
    tenant_patient_id: string;
    created_by: string;
    author_role: 'DOCTOR' | 'NURSE';
    note_type: 'ADMISSION' | 'PROGRESS' | 'DISCHARGE' | 'CONSULT' | 'GENERAL';
    privacy_level: 'NORMAL' | 'SENSITIVE' | 'RESTRICTED';
    status: 'DRAFT' | 'SIGNED';
    declared_time: Date | string;
    created_at: Date | string;
    updated_at?: Date | string | null;
    signed_at?: Date | string | null;
    signed_by?: string | null;
    parent_observation_id?: string | null;
    linked_admission_id?: string | null;
    linked_allergy_id?: string | null;
    linked_addiction_id?: string | null;
    body_html: string;
    body_plain: string;
}

export interface CreateObservationPayload {
    tenant_patient_id: string;
    note_type: 'ADMISSION' | 'PROGRESS' | 'DISCHARGE' | 'CONSULT' | 'GENERAL';
    privacy_level?: 'NORMAL' | 'SENSITIVE' | 'RESTRICTED';
    declared_time: Date | string;
    body_html: string;
    status: 'DRAFT' | 'SIGNED'; // Client declares intent to draft or sign immediately
    linked_admission_id?: string | null;
    linked_allergy_id?: string | null;
    linked_addiction_id?: string | null;
}

export interface UpdateDraftObservationPayload {
    note_type?: 'ADMISSION' | 'PROGRESS' | 'DISCHARGE' | 'CONSULT' | 'GENERAL';
    privacy_level?: 'NORMAL' | 'SENSITIVE' | 'RESTRICTED';
    declared_time?: Date | string;
    body_html?: string;
    linked_admission_id?: string | null;
    linked_allergy_id?: string | null;
    linked_addiction_id?: string | null;
}

export interface CreateAddendumPayload {
    declared_time: Date | string;
    privacy_level?: 'NORMAL' | 'SENSITIVE' | 'RESTRICTED';
    body_html: string;
}
