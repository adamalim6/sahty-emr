
export enum ItemCategory {
    ANTIBIOTICS = 'Antibiotiques',
    ANALGESICS = 'Analgésiques',
    CARDIAC = 'Cardiologie',
    FLUIDS = 'Solutés / IV',
    CONSUMABLES = 'Consommables',
    CONTROLLED = 'Stupéfiants / Contrôlés'
}

export interface StockLocation {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
}

export interface InventoryItem {
    id: string;
    productId: string;
    name: string;
    category: ItemCategory;
    location: string;
    batchNumber: string;
    expiryDate: string;
    unitPrice: number;
    theoreticalQty: number;
    actualQty: number | null;
    lastUpdated?: Date;
}

export enum InventoryStatus {
    DRAFT = 'Brouillon',
    COMPLETED = 'Validé'
}

export interface InventorySession {
    id: string;
    date: string;
    createdBy: string;
    status: InventoryStatus;
    itemsSnapshot: InventoryItem[];
    stats?: {
        totalVariance: number;
        itemsCounted: number;
    };
}

export enum ProductType {
    DRUG = 'Médicament',
    CONSUMABLE = 'Consommable',
    DEVICE = 'Dispositif Médical'
}

export interface ProductSupplier {
    id: string;
    name: string;
    purchasePrice: number;
    isActive: boolean;
}

export interface PharmacySupplier {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Molecule {
    id: string;
    name: string;
}

export type DosageUnit = 'g' | 'mg' | 'ml';

export interface ProductDefinition {
    id: string;
    name: string;
    type: ProductType;
    suppliers: ProductSupplier[];
    profitMargin: number;
    vatRate: number;
    isSubdivisable: boolean;
    subdivisionUnits?: number;          // DEPRECATED: use unitsPerPack
    unitsPerPack: number;               // NOUVEAU: nombre d'unités par boîte (obligatoire)
    molecules?: Molecule[];
    dosage?: number;
    dosageUnit?: DosageUnit;
    therapeuticClass?: string;
    createdAt: Date;
    updatedAt: Date;
}

export enum POStatus {
    DRAFT = 'Brouillon',
    PARTIAL = 'Partiel',
    COMPLETED = 'Terminé'
}

export interface POItem {
    productId: string;
    orderedQty: number;
    deliveredQty: number;
}

export interface PurchaseOrder {
    id: string;
    supplierId: string;
    supplierName: string;
    date: Date;
    status: POStatus;
    items: POItem[];
}

export interface DeliveryNoteItem {
    productId: string;
    deliveredQty: number;
}

export enum ProcessingStatus {
    PENDING = 'En attente',
    PROCESSED = 'Traité'
}

export interface DeliveryNote {
    id: string;
    poId: string;
    date: Date;
    createdBy: string;
    grnReference: string;
    status: ProcessingStatus;
    items: DeliveryNoteItem[];
    processingResult?: QuarantineSessionResult;
}

export enum ReturnReason {
    DAMAGED = 'Endommagé',
    EXPIRED = 'Périmé',
    WRONG_SPEC = 'Non conforme',
    OTHER = 'Autre'
}

export interface BatchEntry {
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    locationId: string;
    returnReason?: ReturnReason;
}

export interface ReturnEntry {
    quantity: number;
    reason: ReturnReason;
    notes?: string;
}

export interface ProductProcessData {
    productId: string;
    deliveredQty: number;
    batches: BatchEntry[];
    returns: ReturnEntry[];
}

export interface QuarantineSessionResult {
    noteId: string;
    processedDate: Date;
    items: ProductProcessData[];
}

export interface PartnerInstitution {
    id: string;
    name: string;
    type: 'Hôpital' | 'Clinique' | 'ONG' | 'Gouvernement';
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    isActive: boolean;
}

export enum StockOutType {
    SUPPLIER_RETURN = 'Retour Fournisseur',
    OUTGOING_LOAN = 'Prêt Sortant',
    DESTRUCTION = 'Bon de Destruction'
}

export enum DestructionReason {
    DAMAGE = 'Dommage / Casse',
    THEFT = 'Vol / Perte',
    EXPIRY = 'Péremption',
    BATCH_RECALL = 'Rappel de Lot'
}

export interface StockOutItem {
    inventoryItemId: string;
    productId: string;
    productName: string;
    batchNumber: string;
    expiryDate: string;
    quantityToRemove: number;
}

export interface StockOutTransaction {
    id: string;
    date: Date;
    type: StockOutType;
    createdBy: string;
    supplierId?: string;
    deliveryNoteRef?: string;
    partnerId?: string;
    destructionReason?: DestructionReason;
    items: StockOutItem[];
}

export enum ReplenishmentStatus {
    PENDING = 'En Attente',
    APPROVED = 'Approuvé',
    REJECTED = 'Rejeté',
    COMPLETED = 'Terminé'
}

export interface ReplenishmentRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    serviceName: string;
    status: ReplenishmentStatus;
    items: {
        productId: string;
        productName: string;
        quantityRequested: number;
        quantityApproved?: number;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

export enum PackStatus {
    ACTIVE = 'Active',
    DISPENSED = 'Dispensée',
    QUARANTINE = 'Quarantaine',
    EXPIRED = 'Périmée',
    RETURNED = 'Retournée',
    DESTROYED = 'Détruite'
}

export interface PackHistoryEvent {
    date: string;
    action: string;
    userId: string;
    details?: string;
}

export interface SerializedPack {
    id: string;
    serialNumber: string;
    productId: string;
    batchNumber: string;
    expiryDate: string;
    locationId: string;
    status: PackStatus;
    history: PackHistoryEvent[];
    createdAt: string;
}

