
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
    nationality?: string;
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

export interface Admission {
    id: string;
    nda: string;
    patientId: string; // Deprecated or mapped to Global
    tenantPatientId?: string; // NEW
    reason: string;
    service: string;
    admissionDate: string;
    dischargeDate?: string;
    doctorName: string;
    roomNumber?: string;
    bedLabel?: string;
    type?: string;
    status: 'En cours' | 'Sorti' | 'Annulé';
    currency?: string;
    tenantId?: string;
}

export interface Appointment {
    id: string;
    patientId: string;
    tenantPatientId?: string; // NEW
    dateTime: string;
    service: string;
    reason: string;
    doctorName: string;
    status: 'scheduled' | 'arrived' | 'late' | 'in-progress' | 'completed' | 'cancelled';
}

export interface Room {
    id: string;
    number: string;
    section: string;
    isOccupied: boolean;
    patientId?: string;
    type: 'single' | 'double' | 'icu';
}

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
