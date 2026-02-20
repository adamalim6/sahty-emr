
export enum Gender {
    Male = 'Homme',
    Female = 'Femme',
}

export interface Patient {
    id: string;
    isProvisional: boolean;
    ipp: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    phone?: string;
    email?: string;
    cin?: string;
    avatar?: string;
    fatherName?: string;
    fatherPhone?: string;
    motherName?: string;
    motherPhone?: string;
    homePhone?: string;
    emergencyContacts?: {
        name: string;
        relationship: string;
        phone: string;
    }[];
    guardian?: {
        firstName: string;
        lastName: string;
        phone: string;
        relationship: string;
        habilitation: string;
        idType: string;
        idNumber: string;
        address: string;
    };
    country?: string;
    city?: string;
    zipCode?: string;
    address?: string;
    maritalStatus?: string;
    profession?: string;
    bloodGroup?: string;
    isPayant: boolean;
    insurance?: {
        mainOrg: string;
        relationship: string;
        registrationNumber?: string;
        complementaryOrg?: string;
    };
}

// ============================================================================
// ADMISSIONS (refactored)
// ============================================================================
export interface Admission {
    id: string;
    tenantId?: string;
    tenantPatientId?: string;
    admissionNumber?: string;
    reason: string;
    attendingPhysicianUserId?: string;
    admittingServiceId?: string;
    responsibleServiceId?: string;
    currentServiceId?: string;
    admissionDate: string;
    dischargeDate?: string;
    status: 'En cours' | 'Sorti' | 'Annulé';
    currency?: string;
    admissionType?: string;
    arrivalMode?: string;
    provenance?: string;

    // Legacy compat — mapped from old columns during transition
    /** @deprecated use admissionNumber */
    nda?: string;
    /** @deprecated use attendingPhysicianUserId */
    doctorName?: string;
    /** @deprecated use currentServiceId/admittingServiceId */
    service?: string;
    /** @deprecated placement belongs to patient_stays */
    roomNumber?: string;
    /** @deprecated placement belongs to patient_stays */
    bedLabel?: string;
    bedId?: string; // New field for patient_stays linkage
    /** @deprecated use tenantPatientId */
    patientId?: string;
    type?: string;
}

// ============================================================================
// PHYSICAL PLACEMENT MODEL
// ============================================================================

export interface RoomType {
    id: string;
    name: string;
    description?: string;
    unitCategory: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION';
    numberOfBeds?: number | null;
    isActive?: boolean;
    createdAt?: string;
}

export interface Room {
    id: string;
    serviceId: string;
    roomTypeId: string;
    name: string;
    description?: string;
    isActive?: boolean;
    createdAt?: string;
    // Joined data
    roomTypeName?: string;
}

export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';

export interface Bed {
    id: string;
    roomId: string;
    label: string;
    status: BedStatus;
    createdAt?: string;
    // Joined data
    roomName?: string;
    currentPatientName?: string;
}

export interface PatientStay {
    id: string;
    admissionId: string;
    tenantPatientId: string;
    bedId: string;
    startedAt: string;
    endedAt?: string | null;
    createdAt?: string;
    // Joined data
    bedLabel?: string;
    roomName?: string;
    serviceName?: string;
}

// ============================================================================
// APPOINTMENTS
// ============================================================================
export interface Appointment {
    id: string;
    patientId: string;
    tenantPatientId?: string;
    dateTime: string;
    service: string;
    reason: string;
    doctorName: string;
    status: 'scheduled' | 'arrived' | 'late' | 'in-progress' | 'completed' | 'cancelled';
}

// ============================================================================
// LEGACY — kept for backward compat
// ============================================================================
export interface UserSettings {
    cin: string;
    passport?: string;
    inpe: string;
    specialty: string;
    availability: string;
    phone: string;
    whatsapp: string;
    email: string;
    rib: string;
    iban: string;
    bankAccount: string;
    shareDataWithSahty: boolean;
}

export interface StockLocation {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
}

export interface AdmissionMedicationConsumption {
    id: string;
    admissionId: string;
    productId: string;
    productName: string;
    quantity: number;
    mode: 'BOX' | 'UNIT';
    lotNumber: string;
    batchNumber: string;
    dispensedAt: string;
    dispensedBy: string;
    sourcePharmacyLocationId?: string;
    source?: 'PHARMACY' | 'SERVICE_STOCK';
    prescriptionId?: string;
}
