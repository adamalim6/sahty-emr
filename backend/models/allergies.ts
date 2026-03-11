export interface PatientAllergy {
    id: string;
    tenant_id: string;
    tenant_patient_id: string;
    
    allergen_dci_id: string;
    allergen_name_snapshot: string;
    
    allergy_type: string;
    severity: string;
    reaction_description: string | null;
    declared_at: string | null;
    
    status: 'ACTIVE' | 'RESOLVED' | 'ENTERED_IN_ERROR';
    
    manifestations?: PatientAllergyManifestation[];
    
    created_at: string;
    created_by: string | null;
    updated_at: string;
    updated_by: string | null;
}

export interface PatientAllergyManifestation {
    id: string;
    tenant_id: string;
    patient_allergy_id: string;
    manifestation_code: 'CUTANEE' | 'RESPIRATOIRE' | 'DIGESTIVE' | 'CARDIOVASCULAIRE' | 'NEUROLOGIQUE';
    created_at: string;
    created_by: string | null;
}

export interface PatientAllergyHistory {
    id: string;
    tenant_id: string;
    tenant_patient_id: string;
    patient_allergy_id: string;
    
    event_type: 'CREATED' | 'DETAILS_UPDATED' | 'STATUS_CHANGED';
    changed_field: string | null;
    
    old_value: string | null;
    new_value: string | null;
    change_note: string | null;
    
    created_at: string;
    created_by: string | null;
    created_by_first_name?: string | null;
    created_by_last_name?: string | null;
}

export interface CreateAllergyPayload {
    allergen_dci_id: string;
    allergy_type: string;
    severity: string;
    reaction_description?: string;
    declared_at?: string;
    status: 'ACTIVE' | 'RESOLVED' | 'ENTERED_IN_ERROR';
    manifestations: string[];
}

export interface UpdateAllergyPayload {
    severity: string;
    reaction_description?: string;
    declared_at?: string;
    manifestations: string[];
}
