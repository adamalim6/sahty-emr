
export enum Gender {
  Male = 'Homme',
  Female = 'Femme',
}

export interface Patient {
  id: string;
  isProvisional: boolean; // Statut de complétude
  ipp: string; 
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone?: string;
  email?: string;
  cin?: string;
  avatar?: string;
  
  // Infos Complémentaires
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  homePhone?: string;

  // Contacts d'urgence (Support multi-contacts)
  emergencyContacts?: {
    name: string;
    relationship: string;
    phone: string;
  }[];

  // Tuteur Légal (Conditionnel mineur)
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

  // Infos Importantes
  country?: string;
  city?: string;
  zipCode?: string;
  address?: string;
  nationality?: string;
  maritalStatus?: string;
  profession?: string;
  bloodGroup?: string;

  // Assurance
  isPayant: boolean; // Si true, pas de tiers payant
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
  patientId: string;
  reason: string;
  service: string;
  admissionDate: string;
  doctorName: string;
  roomNumber?: string;
  bedLabel?: string;
  type?: string;
  status: 'En cours' | 'Sorti' | 'Annulé';
  currency?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
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
