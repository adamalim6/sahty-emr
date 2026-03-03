
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
    skippedEvents?: string[];
    manuallyAdjustedEvents?: Record<string, string>;
}

// --- Frontend-facing payload (backward compatible, what the UI sends) ---
export interface PrescriptionData {
    molecule: string;
    moleculeId?: string;
    commercialName: string;
    productId?: string;
    qty: string | number;
    unit: string;
    unit_id?: string;
    blood_product_type?: string;
    route: string;
    adminMode: AdminMode;
    adminDuration: string;
    schedule_type: PrescriptionType;  // Schedule frequency kind (canonical name)
    dilutionRequired: boolean;
    solvent?: SolventData;
    databaseMode: 'hospital' | 'universal';
    schedule: ScheduleData;
    conditionComment?: string;
    substitutable: boolean;
    prescriptionType?: 'medication' | 'biology' | 'imagery' | 'care' | 'procedure' | 'transfusion';

    // Non-medication fields (sent by future UIs)
    test?: { catalog_test_id?: string; code: string; display_name: string };
    priority?: string;
    exam?: { catalog_exam_id?: string; code: string; display_name: string };
    laterality?: string;
    clinical_indication?: string;
    care_act?: { catalog_care_id?: string; code: string; display_name: string };
    procedure_act?: { catalog_procedure_id?: string; code: string; display_name: string };
    anesthesia_required?: boolean;
    special_requirements?: string;
    product?: { catalog_product_id?: string; code: string; display_name: string };
    quantity?: { value: string; unit: string };
    compatibility_required?: boolean;
    special_instructions?: string;
}

export interface Prescription {
    id: string;
    patientId: string;
    data: PrescriptionData;
    status?: string;
    derived_status?: 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'ELAPSED';
    paused_at?: Date | null;
    paused_by?: string | null;
    stopped_at?: Date | null;
    stopped_by?: string | null;
    stopped_reason?: string | null;
    createdAt: Date;
    createdBy: string;
    createdByFirstName?: string;
    createdByLastName?: string;
    client_id?: string;
}

// --- PLAN (what should happen) ---

export type PrescriptionEventStatus = 'scheduled' | 'cancelled' | 'superseded' | 'expired';

export interface PrescriptionEvent {
    id: string;
    tenant_id: string;
    prescription_id: string;
    admission_id?: string;
    scheduled_at: Date;
    duration?: number;
    status: PrescriptionEventStatus | string;
    created_at: Date;
}

// --- REALITY (what did happen) ---

export type AdministrationActionType =
    | 'attempted' | 'refused' | 'started' | 'stopped'
    | 'restarted' | 'completed' | 'failed' | 'skipped';

export interface AdministrationEvent {
    id: string;
    tenant_id: string;
    prescription_event_id: string;
    action_type: AdministrationActionType | string;
    occurred_at: Date;
    actual_start_at?: Date;
    actual_end_at?: Date;
    performed_by_user_id?: string;
    performed_by_first_name?: string;
    performed_by_last_name?: string;
    note?: string;
    status: string;
    cancellation_reason?: string;
    linked_event_id?: string;
    created_at: Date;
}
