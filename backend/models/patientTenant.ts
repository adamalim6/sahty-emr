import { GlobalPatient, GlobalIdentityDocument, Country } from './patientGlobal';

export { GlobalIdentityDocument };

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

export interface TenantIdentityDocument {
    documentType: string; // Code (e.g. 'CIN')
    documentNumber: string;
    issuingCountry: string;
    isPrimary?: boolean;
    // Optional Global Link
    id?: string;
    globalPatientId?: string;
    documentTypeId?: string;
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
    identityDocuments: TenantIdentityDocument[];
}

export interface CreateTenantPatientPayload {
    masterPatientId?: string; // Optional if creating new local identity
    medicalRecordNumber?: string;
    
    // Core Identity (Required for PROVISIONAL/VERIFIED even if creating local)
    firstName?: string;
    lastName?: string;
    dob?: string;
    sex?: string;
    status?: 'UNKNOWN' | 'PROVISIONAL' | 'VERIFIED';

    contacts?: {
        phone?: string;
        email?: string;
    }[];
    addresses?: {
        addressLine?: string;
        city?: string;
        countryId?: string;
    }[];
    insurances?: InsurancePayload[];
    identityDocuments?: {
        documentType: string;
        documentNumber: string;
        issuingCountry: string;
        isPrimary?: boolean;
    }[];
    // New Fields
    emergencyContacts?: {
        name: string; // schema says related_person_id or related_patient_id, but usually we just want a name/phone for simple cases? 
                      // Wait, schema 023 `patient_emergency_contacts` links to `persons` or `patients`. 
                      // It DOES NOT have a simple `name` column. It requires creating a `person` first if not a patient.
                      // Let's check `persons` table in 023. Yes, it has first_name, last_name, phone.
        phone?: string;
        relationship?: string;
    }[];
    legalGuardians?: LegalGuardianPayload[];
    relationships?: {
        relatedPatientId?: string; // If linking to existing
        firstName?: string; // If creating new person
        lastName?: string;
        relationshipType: string;
    }[];
}

export interface LegalGuardianPayload {
    guardianType: 'EXTERNAL_PERSON' | 'EXISTING_PATIENT';
    // External person fields
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    // Existing patient reference
    relatedPatientId?: string;
    // Common fields
    relationshipType: string;  // 'Père', 'Mère', 'Tuteur légal', etc.
    legalBasis?: string;
    validFrom?: string;        // Default = today
    validTo?: string;
    isPrimary?: boolean;
}

export interface InsurancePayload {
    insuranceOrgId: string;
    policyNumber?: string;
    planName?: string;
    subscriberName?: string;          // snapshot for display
    coverageValidFrom?: string;
    coverageValidTo?: string;
    // Subscriber entity linking
    subscriberType: 'PATIENT' | 'PATIENT_RELATION' | 'PERSON';
    subscriberRelationshipType: string; // 'SELF' | 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD' | 'OTHER'
    subscriberPatientId?: string;       // For PATIENT_RELATION
    // New person creation (PERSON type, external)
    subscriberFirstName?: string;
    subscriberLastName?: string;
    subscriberPhone?: string;
    subscriberEmail?: string;
    // Subscriber document (for PERSON type)
    subscriberDocument?: {
        documentTypeCode: string;
        documentNumber: string;
        issuingCountryCode?: string;
    };
}
