
export interface Person {
    personId: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    createdAt?: string;
}

export interface PatientRelationship {
    relationshipId: string;
    tenantId: string;
    subjectPatientId: string;
    relatedPatientId?: string; // One of these two is required
    relatedPersonId?: string;
    relationshipType: string; // 'MOTHER', 'FATHER', 'SPOUSE', 'CHILD', etc.
    validFrom: string;
    validTo?: string;
    createdAt?: string;
}

export interface PatientEmergencyContact {
    emergencyContactId: string;
    tenantId: string;
    tenantPatientId: string;
    relatedPatientId?: string;
    relatedPersonId?: string;
    relationshipLabel?: string;
    priority?: number;
    createdAt?: string;
}

export interface PatientLegalGuardian {
    legalGuardianId: string;
    tenantId: string;
    tenantPatientId: string;
    relatedPatientId?: string;
    relatedPersonId?: string;
    validFrom: string;
    validTo?: string;
    legalBasis?: string;
    createdAt?: string;
}

export interface PatientDecisionMaker {
    decisionMakerId: string;
    tenantId: string;
    tenantPatientId: string;
    relatedPatientId?: string;
    relatedPersonId?: string;
    role: string; // 'HEALTHCARE_PROXY', 'GUARDIAN', 'SURROGATE'
    priority?: number;
    validFrom: string;
    validTo?: string;
    createdAt?: string;
}

export interface CreatePersonPayload {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
}
