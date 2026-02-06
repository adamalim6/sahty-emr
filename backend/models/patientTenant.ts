import { GlobalPatient, GlobalIdentityDocument, Country } from './patientGlobal';

export interface TenantPatient {
    tenantPatientId: string; // UUID (Primary Key)
    tenantId: string;
    globalPatientId: string;
    medicalRecordNumber?: string;
    status: 'ACTIVE' | 'MERGED' | 'INACTIVE';
    nationalityId?: string;
    nationality?: Country; // Joined view
    createdAt?: string;
}

export interface PatientContact {
    contactId: string;
    tenantPatientId: string;
    phone?: string;
    email?: string;
    createdAt?: string;
}

export interface PatientAddress {
    addressId: string;
    tenantPatientId: string;
    addressLine?: string;
    city?: string;
    countryId?: string;
    country?: Country; // Joined view
    createdAt?: string;
}

export interface PatientInsurance {
    patientInsuranceId: string;
    tenantPatientId: string;
    insuranceOrgId: string;
    insuranceOrgName?: string; // Joined view
    
    policyNumber?: string;
    planName?: string;
    subscriberName?: string;

    coverageValidFrom?: string; // YYYY-MM-DD
    coverageValidTo?: string;

    rowValidFrom?: string; // Audit
    rowValidTo?: string; // Audit (null = active)
}

// Unified View for Frontend / API
export interface PatientDetail extends GlobalPatient {
    tenantPatientId: string;
    tenantId: string; // Add this
    medicalRecordNumber?: string;
    status: 'ACTIVE' | 'MERGED' | 'INACTIVE';
    
    contacts: PatientContact[];
    addresses: PatientAddress[];
    insurances: PatientInsurance[]; // Only showing currently active ones by default
    identityDocuments: GlobalIdentityDocument[];
    
    nationality?: Country;
}

export interface CreateTenantPatientPayload {
    globalPatientId: string;
    medicalRecordNumber?: string;
    nationalityId?: string;
    contacts?: {
        phone?: string;
        email?: string;
    }[];
    addresses?: {
        addressLine?: string;
        city?: string;
        countryId?: string;
    }[];
    insurances?: {
        insuranceOrgId: string;
        policyNumber?: string;
        planName?: string;
        subscriberName?: string;
        coverageValidFrom?: string;
        coverageValidTo?: string;
    }[];
}
