
export enum PackStatus {
    QUARANTINE = 'Quarantaine',
    SEALED = 'Scellée',
    OPENED = 'Entamée',
    EMPTY = 'Vide',
    DISPENSED = 'Dispensée',
    EXPIRED = 'Périmée',
    RETURNED = 'Retournée',
    DESTROYED = 'Détruite'
}

export interface SerializedPack {
    id: string;
    productId: string;
    serialNumber: string;              // Auto-généré ou scanné
    externalSerial?: string;           // GS1/DataMatrix (futur)

    lotNumber: string;
    expiryDate: string;
    locationId: string;

    status: PackStatus;
    unitsPerPack: number;
    remainingUnits: number;

    openedAt?: Date;
    openedByUserId?: string;

    sourceDeliveryNoteId: string;
    createdAt: Date;
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
    productName?: string; // Added for display convenience

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
    returnedQuantity?: number;
}
