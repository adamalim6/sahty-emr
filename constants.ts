
import { Patient, Admission, Appointment, Room, Gender, UserSettings } from './types';

// Utility: Calculate Age
export const calculateAge = (dob: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Utility: Calculate Stay Duration
export const calculateDuration = (startDate: string): string => {
  if (!startDate) return '0h';
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 1) {
    return `${diffDays}j`;
  }
  
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  return `${diffHours}h`;
};

// Utility: Generate IPP
export const generateIPP = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `UMAN-${year}-${random}`;
};

// Utility: Generate NDA
export const generateNDA = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `NDA-${year}-${random}`;
};

// Mock Patients mis à jour avec infos obligatoires (Localisation & Assurance)
export const MOCK_PATIENTS: Patient[] = [
  { 
    id: '1', 
    isProvisional: false, 
    firstName: 'Ahmed', 
    lastName: 'Benali', 
    dateOfBirth: '1980-05-12', 
    gender: Gender.Male, 
    ipp: 'IPP-892301', 
    cin: 'AB452109', 
    avatar: 'https://picsum.photos/200',
    country: 'Maroc',
    city: 'Casablanca',
    address: '24 Rue des Hôpitaux, Maârif',
    nationality: 'Marocaine',
    isPayant: true 
  },
  { 
    id: '2', 
    isProvisional: false, 
    firstName: 'Fatima', 
    lastName: 'Zahra', 
    dateOfBirth: '1995-11-23', 
    gender: Gender.Female, 
    ipp: 'IPP-129304', 
    cin: 'CD901234', 
    avatar: 'https://picsum.photos/201',
    country: 'Maroc',
    city: 'Rabat',
    address: 'Avenue Mohammed V, Appt 4',
    nationality: 'Marocaine',
    isPayant: false,
    insurance: {
        mainOrg: 'CNSS',
        relationship: 'Lui-même',
        registrationNumber: '192837465'
    }
  },
  { 
    id: '3', 
    isProvisional: false, 
    firstName: 'Youssef', 
    lastName: 'Idrissi', 
    dateOfBirth: '1965-02-10', 
    gender: Gender.Male, 
    ipp: 'IPP-552019', 
    cin: 'EF567890', 
    avatar: 'https://picsum.photos/202',
    country: 'Maroc',
    city: 'Marrakech',
    address: 'N° 10 Lotissement Al Massira',
    nationality: 'Marocaine',
    isPayant: true 
  },
  { 
    id: '4', 
    isProvisional: false, 
    firstName: 'Khadija', 
    lastName: 'Amrani', 
    dateOfBirth: '1952-08-30', 
    gender: Gender.Female, 
    ipp: 'IPP-992381', 
    cin: 'GH112233', 
    avatar: 'https://picsum.photos/203',
    country: 'Maroc',
    city: 'Tanger',
    address: 'Quartier Marshan, Villa 5',
    nationality: 'Marocaine',
    isPayant: false,
    insurance: {
        mainOrg: 'CNOPS',
        relationship: 'Conjoint',
        registrationNumber: '556677889'
    }
  },
  { 
    id: '5', 
    isProvisional: false, 
    firstName: 'Omar', 
    lastName: 'Tazi', 
    dateOfBirth: '2010-06-15', 
    gender: Gender.Male, 
    ipp: 'IPP-221002', 
    cin: 'IJ445566', 
    avatar: 'https://picsum.photos/204',
    country: 'Maroc',
    city: 'Fès',
    address: 'Quartier Narjiss, Rue 2',
    nationality: 'Marocaine',
    isPayant: true,
    guardian: {
        firstName: 'Karim',
        lastName: 'Tazi',
        phone: '0661223344',
        relationship: 'Père',
        idType: 'CIN',
        idNumber: 'K98231',
        address: 'Quartier Narjiss, Rue 2, Fès',
        habilitation: 'Tuteur légal'
    }
  },
];

export const MOCK_ADMISSIONS: Admission[] = [
  { 
    id: 'a1', 
    nda: 'NDA-2023-001', 
    patientId: '1', 
    reason: 'Douleur thoracique aiguë', 
    service: 'Cardiologie', 
    admissionDate: '2023-10-25T08:00:00', 
    doctorName: 'Dr. S. Alami',
    roomNumber: '101',
    bedLabel: 'Lit A',
    status: 'En cours',
    type: 'Hospitalisation complète'
  },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 'ap1', patientId: '2', dateTime: '2025-01-01T09:00:00', service: 'Gynécologie', reason: 'Suivi de grossesse', doctorName: 'Dr. Fassi', status: 'arrived' },
];

export const MOCK_ROOMS: Room[] = [
  { id: 'r101', number: '101', section: 'Aile Nord', isOccupied: true, patientId: '1', type: 'single' },
];

export const INITIAL_SETTINGS: UserSettings = {
  cin: 'AB123456',
  inpe: '987654321',
  specialty: 'Cardiologue',
  availability: 'Lun-Ven 09:00 - 17:00',
  phone: '+212 6 00 00 00 00',
  whatsapp: '+212 6 00 00 00 00',
  email: 'medecin@sahty.ma',
  rib: '123456789012345678901234',
  iban: 'MA64 1234 5678 9012 3456 7890 1234',
  bankAccount: '1234567890',
  shareDataWithSahty: false,
};
