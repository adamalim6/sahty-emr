

export interface Person {
    // Deprecated - kept for legacy payloads if needed
    personId: string;
    firstName: string;
    lastName: string;
}

export interface PatientRelationship {
    relationshipId: string;
    tenantId: string;
    subjectPatientId: string;
    
    relatedPatientId?: string; 
    // External Party
    relatedFirstName?: string;
    relatedLastName?: string;

    relationshipType: string; 
    validFrom?: string;
    validTo?: string;
    createdAt?: string;
    
    // Deprecated
    relatedPersonId?: string; 
}

export interface PatientEmergencyContact {
    emergencyContactId: string;
    tenantId: string;
    tenantPatientId: string;
    
    relatedPatientId?: string;
    // External
    name?: string;
    phone?: string;

    relationshipLabel?: string;
    priority?: number;
    createdAt?: string;

    // Deprecated
    relatedPersonId?: string;
}

export interface PatientLegalGuardian {
    legalGuardianId: string;
    tenantId: string;
    tenantPatientId: string;
    
    relatedPatientId?: string;
    // External
    firstName?: string;
    lastName?: string;

    validFrom?: string; // Optional now?
    validTo?: string;
    legalBasis?: string;
    createdAt?: string;
    
    // Deprecated
    relatedPersonId?: string;
}

export interface PatientDecisionMaker {
    decisionMakerId: string;
    tenantId: string;
    tenantPatientId: string;
    
    relatedPatientId?: string;
    // External
    firstName?: string;
    lastName?: string;

    role: string; 
    priority?: number;
    validFrom?: string;
    validTo?: string;
    createdAt?: string;

    // Deprecated
    relatedPersonId?: string;
}

export interface CreatePersonPayload {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
}
