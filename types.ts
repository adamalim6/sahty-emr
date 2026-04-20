
export enum Gender {
  Male = 'M',
  Female = 'F',
}

export interface Patient {
  id: string;
  tenantPatientId?: string; // New
  lifecycleStatus?: 'ACTIVE' | 'MERGED' | 'INACTIVE';
  identityStatus?: 'UNKNOWN' | 'PROVISIONAL' | 'VERIFIED';
  primaryDocType?: string;  // CIN, PASSPORT, CARTE_SEJOUR
  primaryDocValue?: string; // The document number
  ipp: string; // medicalRecordNumber
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone?: string;
  email?: string;
  cin?: string; // kept for list view compat (mapped from first doc)
  avatar?: string;
  identityDocuments?: { documentType: string; documentNumber: string; issuingCountry?: string }[]; // New

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
  dischargeDate?: string;
  doctorName: string;
  roomNumber?: string;
  bedLabel?: string;
  bedId?: string;
  type?: string;
  arrivalMode?: string;
  provenance?: string;
  status: 'En cours' | 'Sorti' | 'Annulé';
  currency?: string;
  tenantId?: string;
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

// ============================================================
// Admission Charge Billing (capture foundation)
// ============================================================
export type AdmissionChargeStatus =
  | 'CAPTURED'
  | 'PENDING_REVIEW'
  | 'READY_TO_POST'
  | 'VOIDED_BEFORE_POSTING'
  | 'POSTED';

export type PricingStatus =
  | 'RESOLVED'
  | 'PROVISIONAL'
  | 'MANUAL_OVERRIDE'
  | 'REPRICE_RECOMMENDED'
  | 'PENDING_REVIEW';

export type PricingLockStatus = 'AUTO' | 'MANUAL_LOCK';

export type CoverageResolutionMode =
  | 'COVERAGE_MATCHED'
  | 'FALLBACK_DEFAULT'
  | 'MANUAL'
  | 'NONE';

export type DispatchType =
  | 'PART_MEDECIN_1'
  | 'PART_MEDECIN_2'
  | 'PART_CLINIQUE_BLOC'
  | 'PART_PHARMACIE'
  | 'PART_LABO'
  | 'PART_RADIOLOGIE'
  | 'PART_SEJOUR';

export interface AdmissionChargeDispatch {
  id: string;
  admission_charge_snapshot_id: string;
  dispatch_type: DispatchType;
  sequence_no: number;
  amount: string;
  currency_code: string;
}

export interface AdmissionChargeSnapshot {
  id: string;
  snapshot_no: number;
  unit_price_snapshot: string;
  total_price_snapshot: string;
  currency_code: string;
  billing_label: string | null;
  pricing_list_code: string | null;
  pricing_list_version_no: number | null;
  pricing_list_item_version_no: number | null;
  pricing_source_type: 'PRICING_LIST' | 'MANUAL' | 'NONE';
  snapshot_source: string;
  quantity: string;
  dispatches: AdmissionChargeDispatch[];
}

export interface AdmissionChargeEvent {
  id: string;
  admission_id: string;
  admission_act_id: string;
  patient_id: string;
  global_act_id: string;
  global_act_code_sih?: string;
  global_act_libelle_sih?: string;
  global_act_type_acte?: string;
  quantity: string;
  currency_code: string;
  status: AdmissionChargeStatus;
  pricing_status: PricingStatus;
  pricing_lock_status: PricingLockStatus;
  coverage_resolution_mode: CoverageResolutionMode;
  coverage_resolution_reason: string | null;
  admission_coverage_id: string | null;
  current_snapshot_id: string | null;
  captured_at: string;
  voided_at: string | null;
  void_reason: string | null;
  current_snapshot: AdmissionChargeSnapshot | null;
}
