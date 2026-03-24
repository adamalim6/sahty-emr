export interface PatientLabReport {
    id: string;
    tenant_patient_id: string;
    admission_id?: string;
    source_type: 'EXTERNAL_REPORT' | 'INTERNAL_LIMS' | 'EXTERNAL_INTERFACE' | 'LEGACY_MIGRATION';
    status: 'ACTIVE' | 'ENTERED_IN_ERROR' | 'DRAFT' | 'VALIDATED' | 'AMENDED';
    structuring_status: 'DOCUMENT_ONLY' | 'STRUCTURED';
    
    report_title?: string;
    source_lab_name?: string;
    source_lab_report_number?: string;
    
    report_date?: Date;
    collected_at?: Date;
    received_at?: Date;
    
    used_ai_assistance: boolean;
    interpretation_text?: string;
    
    uploaded_by_user_id: string;
    uploaded_at: Date;
    
    structured_by_user_id?: string;
    structured_at?: Date;
    
    entered_in_error_by_user_id?: string;
    entered_in_error_at?: Date;
    entered_in_error_reason?: string;
    
    notes?: string;
    
    created_at: Date;
    updated_at: Date;
}

export interface PatientLabReportTest {
    id: string;
    patient_lab_report_id: string;
    global_act_id?: string;
    panel_id?: string;
    raw_test_label?: string;
    display_order: number;
    notes?: string;
    created_at: Date;
    updated_at: Date;
}

export interface PatientLabResult {
    id: string;
    patient_lab_report_id: string;
    patient_lab_report_test_id?: string;
    
    analyte_id?: string;
    analyte_context_id?: string;
    lab_analyte_context_id?: string;
    result_value_id?: string;
    raw_analyte_label?: string;
    
    value_type: 'NUMERIC' | 'TEXT' | 'BOOLEAN' | 'CHOICE';
    numeric_value?: number;
    text_value?: string;
    boolean_value?: boolean;
    choice_value?: string;
    
    unit_id?: string;
    raw_unit_text?: string;
    
    reference_range_text?: string;
    reference_low_numeric?: number;
    reference_high_numeric?: number;
    reference_profile_id?: string;
    reference_rule_id?: string;
    
    raw_abnormal_flag_text?: string;
    interpretation?: string; 
    
    observed_at?: Date;
    method_id?: string;
    specimen_type_id?: string;
    
    source_line_reference?: string;
    
    status: 'ACTIVE' | 'ENTERED_IN_ERROR';
    entered_in_error_by_user_id?: string;
    entered_in_error_at?: Date;
    entered_in_error_reason?: string;
    
    notes?: string;
    
    created_at: Date;
    updated_at: Date;
}

export interface CreatePatientLabReportDTO {
    tenant_patient_id: string;
    admission_id?: string;
    source_type: 'EXTERNAL_REPORT' | 'INTERNAL_LIMS' | 'EXTERNAL_INTERFACE' | 'LEGACY_MIGRATION';
    status: 'ACTIVE' | 'ENTERED_IN_ERROR' | 'DRAFT' | 'VALIDATED' | 'AMENDED';
    structuring_status: 'DOCUMENT_ONLY' | 'STRUCTURED';
    report_title?: string;
    source_lab_name?: string;
    source_lab_report_number?: string;
    report_date?: Date | string;
    collected_at?: Date | string;
    received_at?: Date | string;
    interpretation_text?: string;
    notes?: string;
    uploaded_by_user_id: string;
}

export interface CreatePatientLabReportTestDTO {
    patient_lab_report_id: string;
    global_act_id?: string;
    panel_id?: string;
    raw_test_label?: string;
    display_order?: number;
    notes?: string;
}

export interface CreatePatientLabResultDTO {
    patient_lab_report_id: string;
    patient_lab_report_test_id?: string;
    analyte_id?: string;
    analyte_context_id?: string;
    lab_analyte_context_id?: string;
    result_value_id?: string;
    raw_analyte_label?: string;
    value_type: 'NUMERIC' | 'TEXT' | 'BOOLEAN' | 'CHOICE';
    numeric_value?: number;
    text_value?: string;
    boolean_value?: boolean;
    choice_value?: string;
    unit_id?: string;
    raw_unit_text?: string;
    reference_range_text?: string;
    reference_low_numeric?: number;
    reference_high_numeric?: number;
    reference_profile_id?: string;
    reference_rule_id?: string;
    raw_abnormal_flag_text?: string;
    interpretation?: string; 
    observed_at?: Date | string;
    method_id?: string;
    specimen_type_id?: string;
    source_line_reference?: string;
    notes?: string;
}
