
export enum ContainerType {
    SEALED_BOX = 'SEALED_BOX',
    OPENED_BOX = 'OPENED_BOX',
    UNIT_BATCH = 'UNIT_BATCH',
    RETURNED_UNIT_BATCH = 'RETURNED_UNIT_BATCH',
    RETURNED_BOX = 'RETURNED_BOX'
}

export enum ContainerState {
    SEALED = 'SEALED',
    OPENED = 'OPENED',
    RETURNED_PENDING_QA = 'RETURNED_PENDING_QA',
    APPROVED_NORMAL = 'APPROVED_NORMAL',
    APPROVED_DONATION = 'APPROVED_DONATION',
    REJECTED = 'REJECTED',
    DESTROYED = 'DESTROYED'
}

export interface Container {
    id: string;
    type: ContainerType;
    productId: string;
    productVersionId?: string; // Links to specific version of product (subdivisibility rules etc)

    // Traceability
    serialNumber?: string; // MANDATORY for SEALED_BOX, OPENED_BOX, RETURNED_BOX
    lotNumber: string;
    expiryDate: string;
    dispensationId?: string; // Link to original dispensation

    // Filiation
    parentContainerId?: string; // Link to mother box (MANDATORY for UNIT_BATCH / RETURNED_UNIT_BATCH)

    // Location
    originLocation: 'CENTRAL_PHARMACY' | 'SERVICE_STOCK';
    currentLocation: string; // e.g. "PHARMACY_CENTRAL", "SERVICE_MEDECINE", "PATIENT_ADMISSION_XXX"

    // Content
    unitsPerPack: number;
    availableBoxes: number; // 1 for SEALED_BOX, 0 for others usually
    availableUnits: number; // Remaining units

    state: ContainerState;

    history: ContainerMovement[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ContainerMovement {
    id: string;
    type: 'DISPENSE' | 'TRANSFER' | 'RETURN' | 'QA_DECISION' | 'DESTRUCTION' | 'REPACK';
    date: Date;
    fromLocation: string;
    toLocation: string;
    userId: string;
    details?: any;
}
