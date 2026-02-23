export interface ObservationParameter {
    id: string;
    code: string;
    label: string;
    unit?: string;
    unitId?: string;
    valueType: 'number' | 'text' | 'boolean';
    normalMin?: number;
    normalMax?: number;
    warningMin?: number;
    warningMax?: number;
    hardMin?: number;
    hardMax?: number;
    isHydricInput: boolean;
    isHydricOutput: boolean;
    sortOrder: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ObservationGroup {
    id: string;
    code: string;
    label: string;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
    parameters?: ObservationParameter[]; // Joined association
}

export interface ObservationFlowsheet {
    id: string;
    code: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    groups?: ObservationGroup[]; // Joined association
}

export interface FlowsheetGroupMap {
    flowsheetId: string;
    groupId: string;
    sortOrder: number;
}

export interface GroupParameterMap {
    groupId: string;
    parameterId: string;
    sortOrder: number;
}

export interface SurveillanceCellData {
    v: string | number | boolean;
    by: string;
    at: string;
    n: number;
}

export interface SurveillanceHourBucket {
    id: string;
    tenantId: string;
    admissionId?: string;
    tenantPatientId: string;
    bucketStart: string;
    values: Record<string, SurveillanceCellData>;
    revision: number;
    updatedAt?: string;
    updatedByUserId?: string;
    createdAt?: string;
    createdByUserId?: string;
}
