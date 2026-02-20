import { GlobalPatient, GlobalIdentityDocument, Country } from './patientGlobal';

export { GlobalIdentityDocument };

export interface TenantPatient {
    tenantPatientId: string; // UUID (Primary Key)
    tenantId: string;
    
    // Core Demographics
    firstName?: string;
    lastName?: string;
    dob?: string;
    sex?: string;

    lifecycleStatus: 'ACTIVE' | 'MERGED' | 'INACTIVE';
    identityStatus: 'UNKNOWN' | 'PROVISIONAL' | 'VERIFIED';
    mergedIntoTenantPatientId?: string;
    createdAt?: string;

    // Derived / Joined Fields (not in table anymore)
    medicalRecordNumber?: string; // Sourced from identity_ids
}

export interface IdentityId {
    identityId: string;
    tenantPatientId: string;
    identityTypeCode: string; // LOCAL_MRN, NATIONAL_ID, PASSPORT, SAHTY_MPI_PERSON_ID
    identityValue: string;
    issuingCountryCode?: string;
    isPrimary: boolean;
    status: string;
    createdAt?: string;
}

export interface PatientRelationshipLink {
    relationshipId: string;
    tenantId: string;
    subjectTenantPatientId: string;
    
    // Target (Patient OR External)
    relatedTenantPatientId?: string;
    relatedFirstName?: string;
    relatedLastName?: string;
    relatedIdentityTypeCode?: string;
    relatedIdentityValue?: string;
    relatedIssuingCountryCode?: string;
    relatedPhone?: string;

    relationshipTypeCode: string; // FATHER, MOTHER, GUARDIAN
    isLegalGuardian: boolean;
    isDecisionMaker: boolean;
    isEmergencyContact: boolean;
    priority?: number;
    isPrimary: boolean;
    validFrom?: string;
    validTo?: string;
}

// Coverage Models
export interface Coverage {
    coverageId: string;
    tenantId: string;
    organismeId: string;
    policyNumber: string;
    groupNumber?: string;
    planName?: string;
    coverageTypeCode?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    status: string;
}

export interface CoverageMember {
    coverageMemberId: string;
    coverageId: string;
    tenantPatientId?: string; // Nullable for external subscribers
    relationshipToSubscriberCode?: string; // SELF, SPOUSE, CHILD, OTHER
    
    // External Subscriber Details
    memberFirstName?: string;
    memberLastName?: string;
    memberIdentityType?: string;
    memberIdentityValue?: string;
    memberIssuingCountry?: string;

    createdAt?: string;
}

// Coverages are now admission-level (admission_coverages), not patient-level


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
    country?: Country;
    isPrimary?: boolean;
}



export interface PatientInsurance {
    patientInsuranceId: string;
    tenantPatientId: string;
    insuranceOrgId: string;
    insuranceOrgName?: string;
    policyNumber?: string;
    planName?: string;
    subscriberName?: string;
    coverageValidFrom?: string;
    coverageValidTo?: string;
    rowValidFrom?: string;
    rowValidTo?: string;
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

// Unified View for Frontend / API
export interface PatientDetail extends GlobalPatient {
    tenantPatientId: string;
    tenantId: string;
    medicalRecordNumber?: string; // computed from identity_ids
    ipp?: string; // alias for medicalRecordNumber (for frontend compat)
    lifecycleStatus: 'ACTIVE' | 'MERGED' | 'INACTIVE';
    identityStatus: 'UNKNOWN' | 'PROVISIONAL' | 'VERIFIED';
    primaryDocType?: string;  // CIN, PASSPORT, CARTE_SEJOUR 
    primaryDocValue?: string; // The document number
    
    // Legacy / Convenience fields
    dob?: string; // alias for dateOfBirth
    sex?: string; // alias for gender

    contacts: PatientContact[]; // or map from columns
    addresses: PatientAddress[];
    
    
    identifiers: IdentityId[];
    relationships: PatientRelationshipLink[];
    coverages: AdmissionCoverage[];
}

// History & Snapshots
export interface CoverageChangeHistory {
    changeId: string;
    tenantId: string;
    coverageId: string;
    coverageMemberId?: string;
    changeTypeCode: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    changeSource: string;
    changedByUserId?: string;
    changeReason?: string;
    changedAt: string;
}

export interface AdmissionCoverage {
    admissionCoverageId: string;
    tenantId: string;
    admissionId: string;
    coverageId: string; // Reference only
    filingOrder: number;
    
    // Snapshot Fields
    organismeId: string;
    policyNumber?: string;
    groupNumber?: string;
    planName?: string;
    coverageTypeCode?: string;

    subscriberFirstName?: string;
    subscriberLastName?: string;
    subscriberIdentityType?: string;
    subscriberIdentityValue?: string;
    subscriberIssuingCountry?: string;

    createdAt?: string;

    // Joined for display
    organismeName?: string;
    members?: AdmissionCoverageMember[];
}

export interface AdmissionCoverageMember {
    admissionCoverageMemberId: string;
    tenantId: string;
    admissionCoverageId: string;
    tenantPatientId?: string;
    
    memberFirstName?: string;
    memberLastName?: string;
    relationshipToSubscriberCode?: string;
    memberIdentityType?: string;
    memberIdentityValue?: string;
    memberIssuingCountry?: string;

    createdAt?: string;
}

export interface AdmissionCoverageChangeHistory {
    changeId: string;
    tenantId: string;
    admissionId: string;
    admissionCoverageId?: string;
    admissionCoverageMemberId?: string;
    changeTypeCode: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    changeSource: string;
    changedByUserId?: string;
    changeReason?: string;
    changedAt: string;
}

// Registration Payload
export interface CreateTenantPatientPayload {
    // Demographics
    firstName: string;
    lastName: string;
    dob?: string;
    sex?: string;
    identityStatus: 'UNKNOWN' | 'PROVISIONAL' | 'VERIFIED';
    
    // Master ID (Optional)
    masterPatientId?: string;

    // Contact Info
    phone?: string;
    email?: string;
    contacts?: {
        phone?: string;
        email?: string;
    }[];
    
    addresses?: {
        addressLine?: string;
        city?: string;
        countryId?: string; // or code
    }[];

    // Identifiers
    identifiers?: {
        typeCode: string; // CIN, PASSPORT
        value: string;
        issuingCountryCode?: string;
        isPrimary?: boolean;
    }[];

    // Relationships (including guardians, emergency contacts)
    relationships?: {
        relationshipTypeCode: string;
        // Link to existing patient
        relatedTenantPatientId?: string;
        // OR External party details
        relatedFirstName?: string;
        relatedLastName?: string;
        relatedIdentity?: {
            typeCode: string;
            value: string;
            countryCode?: string;
        };
        relatedPhone?: string;
        
        isLegalGuardian?: boolean;
        isEmergencyContact?: boolean;
        isDecisionMaker?: boolean;
        isPrimary?: boolean;
    }[];
    
    legalGuardians?: LegalGuardianPayload[];
    emergencyContacts?: {
        name: string;
        phone?: string;
        relationship?: string;
    }[];

    // Coverages
    coverages?: {
        insuranceOrgId: string;
        policyNumber: string;
        relationshipToSubscriberCode: string; // SELF, SPOUSE
        subscriber?: {
            tenantPatientId?: string; // If existing patient is subscriber
            
            // External Subscriber Details
            firstName?: string;       
            lastName?: string;
            identifiers?: { typeCode: string; value: string; countryCode?: string; }[];
        };
        // If reusing existing coverage from search
        existingCoverageId?: string;
    }[];
}

export interface LegalGuardianPayload {
    guardianType: 'EXTERNAL_PERSON' | 'EXISTING_PATIENT';
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    relatedPatientId?: string;
    relationshipType: string;
    legalBasis?: string;
    validFrom?: string;
    validTo?: string;
    isPrimary?: boolean;
}

export interface InsurancePayload {
    insuranceOrgId: string;
    policyNumber?: string;
    planName?: string;
    subscriberName?: string;
    coverageValidFrom?: string;
    coverageValidTo?: string;
    subscriberType: 'PATIENT' | 'PATIENT_RELATION' | 'PERSON';
    subscriberRelationshipType: string;
    subscriberPatientId?: string;
    subscriberFirstName?: string;
    subscriberLastName?: string;
    subscriberPhone?: string;
    subscriberEmail?: string;
    subscriberDocument?: {
        documentTypeCode: string;
        documentNumber: string;
        issuingCountryCode?: string;
    };
}
