export interface PatientAddiction {
    id: string;
    tenant_patient_id: string;
    addiction_type: 'TOBACCO' | 'ALCOHOL' | 'CANNABIS' | 'OPIOIDS' | 'STIMULANTS' | 'BEHAVIORAL' | 'OTHER';
    substance_label: string | null;
    qty: number | null;
    unit: string | null;
    frequency: string | null;
    status: 'ACTIVE' | 'WITHDRAWAL' | 'ABSTINENT' | 'RESOLVED' | 'ENTERED_IN_ERROR';
    stop_motivation_score: number | null;
    start_date: string | null;
    last_use_date: string | null;
    created_by: string;
    created_at: Date;
    updated_at: Date | null;
}

export interface PatientAddictionHistory {
    id: string;
    addiction_id: string;
    tenant_patient_id: string;
    field_name: string;
    old_value_text: string | null;
    new_value_text: string | null;
    old_value_number: number | null;
    new_value_number: number | null;
    changed_by: string;
    changed_at: Date;
}

export type CreateAddictionPayload = Omit<PatientAddiction, 'id' | 'created_at' | 'updated_at'>;
export type UpdateAddictionPayload = Partial<Omit<PatientAddiction, 'id' | 'tenant_patient_id' | 'created_by' | 'created_at' | 'updated_at'>>;
