
export type PrescriptionType = 'frequency' | 'one-time' | 'punctual-frequency';
export type DailySchedule = 'everyday' | 'specific-days' | 'every-other-day'; // Ajouté 'every-other-day'
export type ScheduleMode = 'cycle' | 'specific-time' | 'simple';
export type DurationUnit = 'days' | 'weeks' | 'months';
export type AdminMode = 'instant' | 'continuous' | 'permanent';

// Add the MoleculeDatabase type definition
export type MoleculeDatabase = Record<string, string[]>;

export interface SolventData {
  molecule: string;
  commercialName: string;
  qty: string;
  unit: string;
}

export interface ScheduleData {
  dailySchedule: DailySchedule;
  mode: ScheduleMode;
  interval: string;
  isCustomInterval: boolean;
  startDateTime: string;
  durationValue: string;
  durationUnit: DurationUnit;
  selectedDays: string[];
  specificTimes: string[];
  simpleCount: string;
  simplePeriod: 'day' | 'week' | 'month';
  intervalDuration: string; // Nouveau champ pour la durée entre les prises en mode Simple
}

export interface FormData {
  molecule: string;
  moleculeId?: string;
  commercialName: string;
  productId?: string;
  qty: string;
  unit: string;
  route: string;
  routeLabel?: string; // Route display name
  adminMode: AdminMode;
  adminDuration: string;
  schedule_type: PrescriptionType;
  dilutionRequired: boolean;
  solvent?: SolventData; // Nouveau champ pour les détails du solvant
  databaseMode: 'hospital' | 'universal'; // Nouveau champ pour le mode de base de données
  schedule: ScheduleData;
  conditionComment?: string; // Nouveau champ pour les conditions/commentaires
  substitutable: boolean; // Nouveau champ pour la substituabilité
  skippedEvents?: string[]; // Nouveau champ pour les prises sautées (IDs/Dates)
  manuallyAdjustedEvents?: Record<string, string>; // ID -> ISO Date string for time shifts
  prescriptionType?: 'medication' | 'biology' | 'imagery' | 'care' | 'transfusion'; // Type de prescription
}

// Ajout de l'interface pour le retour de getDoseScheduleCards, incluant isError
export interface ScheduledDose {
  id: string; // Original planned ISO string
  plannedDateTime: string;
  effectiveDateTime: string | null;
  isSkipped: boolean;
}

export interface DoseScheduleResult {
  needsDetail: boolean;
  message: string | null;
  cards: Array<{ date: Date; time: string; id: string; }>;
  scheduledDoses: ScheduledDose[]; // Validation stricte
  allDosesMap: Map<string, { date: Date; time: string; id: string; }>;
  isError: boolean;
}

export interface Prescription {
  id: string;
  patientId: string;
  data: FormData;
  status?: string;
  derived_status?: 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'ELAPSED';
  paused_at?: string | null;
  paused_by?: string | null;
  stopped_at?: string | null;
  stopped_by?: string | null;
  stopped_reason?: string | null;
  createdAt: Date;
  createdBy: string;
  createdByFirstName?: string;
  createdByLastName?: string;
}

export type ExecutionStatus = 'planned' | 'administered' | 'not-administered' | 'late';

export interface PrescriptionExecution {
  id: string;
  prescriptionId: string;
  plannedDate: string; // ISO
  actualDate?: string;
  status: ExecutionStatus;
  justification?: string;
  performedBy?: string;
  updatedAt: Date;
}
