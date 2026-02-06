
export interface GlobalPatient {
    id: string; // UUID
    firstName: string;
    lastName: string;
    dateOfBirth: string; // YYYY-MM-DD
    gender: 'M' | 'F' | 'OTHER';
    createdAt?: string;
    updatedAt?: string;
}

export interface IdentityDocumentType {
    id: string; // UUID
    code: string; // e.g. CIN, PASSPORT
    label: string;
}

export interface GlobalIdentityDocument {
    id: string; // UUID
    globalPatientId: string;
    documentTypeId: string;
    documentNumber: string;
    isPrimary: boolean;
    expiresAt?: string; // YYYY-MM-DD
    createdAt?: string;
    updatedAt?: string;
}

export interface Country {
    id: string; // UUID
    isoCode: string; // e.g. MA, FR
    name: string;
}

export interface CreateGlobalPatientPayload {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'M' | 'F' | 'OTHER';
    documents: {
        documentTypeCode: string; // Use Code for easier API usage (e.g. 'CIN')
        documentNumber: string;
        isPrimary?: boolean;
        expiresAt?: string;
    }[];
}
