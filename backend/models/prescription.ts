
export type PrescriptionType = 'frequency' | 'one-time' | 'punctual-frequency';
export type DailySchedule = 'everyday' | 'specific-days' | 'every-other-day';
export type ScheduleMode = 'cycle' | 'specific-time' | 'simple';
export type DurationUnit = 'days' | 'weeks' | 'months';
export type AdminMode = 'instant' | 'continuous' | 'permanent';

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
    intervalDuration: string;
}

export interface PrescriptionData {
    molecule: string;
    commercialName: string;
    qty: string;
    unit: string;
    route: string;
    adminMode: AdminMode;
    adminDuration: string;
    type: PrescriptionType;
    dilutionRequired: boolean;
    solvent?: SolventData;
    databaseMode: 'hospital' | 'universal';
    schedule: ScheduleData;
    conditionComment?: string;
    substitutable: boolean;
    prescriptionType?: 'medication' | 'biology' | 'imagery' | 'care';
}

export interface Prescription {
    id: string;
    patientId: string;
    data: PrescriptionData;
    createdAt: Date;
    createdBy: string;
    client_id?: string;
}

export type ExecutionStatus = 'planned' | 'administered' | 'not-administered' | 'late';

export interface PrescriptionExecution {
    id: string;
    prescriptionId: string;
    plannedDate: string; // ISO Date String
    actualDate?: string; // ISO Date String (when action was taken)
    status: ExecutionStatus;
    justification?: string; // Required if not-administered
    performedBy?: string; // User who performed the action
    updatedAt: Date;
}
