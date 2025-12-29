
import { ContainerType, ContainerState } from './container';

export enum ReturnRequestStatus {
    PENDING_QA = 'PENDING_QA',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    REPACKED = 'REPACKED'
}

export enum ReturnDestination {
    CENTRAL_PHARMACY = 'CENTRAL_PHARMACY',
    SERVICE_STOCK = 'SERVICE_STOCK'
}

export interface ReturnRequestItem {
    containerId: string; // The specific container being returned (or created during return)
    quantity: number; // Units or boxes depending on type
    type: ContainerType;
    condition: 'SEALED' | 'OPENED';
    dispensationId?: string; // Link to original dispensation
}

export interface ReturnRequest {
    id: string;
    admissionId: string; // Source
    serviceId?: string; // If returned from service stock directly without admission context? (For now focus on Admission return)

    items: ReturnRequestItem[];

    destination: ReturnDestination;
    targetLocationId?: string; // If SERVICE_STOCK, which location?
    status: ReturnRequestStatus;

    createdAt: Date;
    createdBy: string;

    qaDecisionAt?: Date;
    qaDecisionBy?: string;
    qaComments?: string;
}
