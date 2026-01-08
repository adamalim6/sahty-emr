
export enum PackStatus {
    QUARANTINE = 'Quarantaine',
    SEALED = 'Scellée',
    OPENED = 'Entamée',
    EMPTY = 'Vide',
    DISPENSED = 'Dispensée',
    EXPIRED = 'Périmée',
    RETURNED = 'Retournée',
    DESTROYED = 'Détruite',
    ACTIVE = 'Active' // Mapping for legacy/safety
}

export interface SerializedPack {
    id: string;
    productId: string;
    serialNumber: string;              // Auto-généré ou scanné
    externalSerial?: string;           // GS1/DataMatrix (futur)

    batchNumber: string;
    expiryDate: string;
    locationId: string;
    tenantId?: string; // Tenant Isolation

    status: PackStatus;
    unitsPerPack: number;
    remainingUnits: number;

    // History needs to be here if PharmacyService uses it
    history: any[]; // Using any[] to avoid circular dep or re-import for now, or define PackHistoryEvent here

    openedAt?: Date;
    openedByUserId?: string;



    sourceDeliveryNoteId: string;
    createdAt: Date;
}

export interface LooseUnitItem {
    id: string; // Internal tracking ID
    productId: string;
    batchNumber: string; // Derived from source or manual
    expiryDate: string;
    locationId: string;
    quantity: number;
    tenantId?: string;
    serviceId?: string;
}

export enum DispensationMode {
    FULL_PACK = 'Boîte Complète',
    UNIT = 'Par Unité'
}

export interface Dispensation {
    id: string;
    prescriptionId: string;
    admissionId: string;
    productId: string;
    productName?: string;

    mode: DispensationMode;
    quantity: number;                  // Nombre d'unités dispensées

    serializedPackId: string;
    lotNumber: string;                 // Dénormalisé pour affichage
    expiryDate: string;                // Dénormalisé pour affichage
    serialNumber: string;              // Dénormalisé pour affichage

    unitPriceExclVAT: number;
    vatRate: number;
    totalPriceInclVAT: number;

    dispensedAt: Date;
    dispensedBy: string;
    status?: 'DISPENSED' | 'RETURNED';
    returnedQuantity?: number; // Track partial returns
}
