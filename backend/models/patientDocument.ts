export type DocumentType = 'LAB_REPORT' | 'RADIOLOGY' | 'PRESCRIPTION' | 'OTHER';
export type DocumentSourceType = 'UPLOAD' | 'SCANNER' | 'API' | 'IMPORT';
export type DocumentRole = 'PRIMARY' | 'ATTACHMENT';

export interface PatientDocument {
    id: string;
    tenant_id: string;
    tenant_patient_id: string;
    
    document_type: DocumentType | string;
    
    original_filename?: string | null;
    stored_filename?: string | null;
    storage_path?: string | null;
    
    mime_type?: string | null;
    original_mime_type?: string | null;
    file_extension?: string | null;
    file_size_bytes?: number | null;
    checksum?: string | null;
    
    source_system?: string | null;
    
    extracted_text?: string | null;
    ai_processed: boolean;
    
    uploaded_by_user_id?: string | null;
    uploaded_at?: Date | null;
    
    actif: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreatePatientDocumentDTO {
    tenant_id: string;
    tenant_patient_id: string;
    document_type: DocumentType | string;
    original_filename?: string;
    mime_type?: string;
    original_mime_type?: string;
    file_extension?: string;
    source_system?: string;
    uploaded_by_user_id?: string;
}

export interface UpdatePatientDocumentStorageDTO {
    stored_filename: string;
    storage_path: string;
    file_size_bytes: number;
    checksum?: string;
}

export interface PatientLabReportDocumentLink {
    id: string;
    patient_lab_report_id: string;
    document_id: string;
    derivation_type: 'ORIGINAL' | 'MERGED';
    sort_order?: number | null;
    actif: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface AttachLabReportDocumentDTO {
    patient_lab_report_id: string;
    document_id: string;
    derivation_type?: 'ORIGINAL' | 'MERGED';
    sort_order?: number;
}
