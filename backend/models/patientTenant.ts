import { GlobalPatient, GlobalIdentityDocument, Country } from './patientGlobal';

export interface TenantPatient {
    tenantPatientId: string; // UUID (Primary Key)
    tenantId: string;
    masterPatientId: string; // FK to identity.master_patients
    mpiLinkStatus?: string; // 'UNLINKED' | 'LINKED' etc.
    medicalRecordNumber?: string;
    
    // Snapshot
    firstName?: string;
    lastName?: string;
    dob?: string;
    sex?: string;

    status: 'ACTIVE' | 'MERGED' | 'INACTIVE';
    mergedIntoTenantPatientId?: string; // Set when status = 'MERGED'
    nationalityId?: string;
    nationality?: Country; // Joined view
    createdAt?: string;
}

export interface PatientTenantMergeEvent {
    mergeEventId: string;
    tenantId: string;
    sourceTenantPatientId: string;
    targetTenantPatientId: string;
    reason?: string;
    mergedByUserId?: string;
    createdAt: string;
}

export interface MergeChartGroup {
    masterPatientId: string;
    charts: TenantPatient[];
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
    addressLine2?: string;
    postalCode?: string;
    region?: string;
    countryCode?: string;
    city?: string;
    countryId?: string; // Legacy?
    country?: Country; // Joined view
    isPrimary?: boolean;
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
    tenantId: string;
    medicalRecordNumber?: string;
    status: 'ACTIVE' | 'MERGED' | 'INACTIVE';
    
    // Explicit snapshot fields in case Global is missing (though GlobalPatient has them)
    // We can rely on GlobalPatient fields being populated from local snapshot in the service.
    
    contacts: PatientContact[];
    addresses: PatientAddress[];
    insurances: PatientInsurance[]; // Only showing currently active ones by default
    identityDocuments: GlobalIdentityDocument[];
    
    nationality?: Country;
}

export interface CreateTenantPatientPayload {
    masterPatientId: string; // Renamed from globalPatientId
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
