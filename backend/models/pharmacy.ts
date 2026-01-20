
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
    // Nouveaux champs pour import Maroc
    form?: string;
    presentation?: string;
    brandName?: string; // Spécialité
    marketInfo?: {
        ppv?: number;
    };
    isActive: boolean;
    tenantId?: string; // New: Tenant Isolation
    serviceId?: string; // Linked to Service
    scope?: 'PHARMACY' | 'SERVICE'; // Strict Scope Enforcement
}

// --- 🏗 NEW STOCK ARCHITECTURE (PHYSICAL LEDGERS) ---

export type ContainerType = 'SEALED_BOX' | 'OPEN_BOX' | 'LOOSE_UNITS';

export interface BaseStockContainer {
    id: string;
    type: ContainerType;
    productId: string;
    productName: string;
    lot: string; // batchNumber
    expiration: string; // ISO Date
    locationId: string;
    createdAt: string; // ISO Date
    tenantId?: string;
}

export interface SealedBox extends BaseStockContainer {
    type: 'SEALED_BOX';
    serial: string; // QR Code
    unitsPerBox: number;
    status: 'SEALED'; // Immutable in this valid state
}

export interface OpenBox extends BaseStockContainer {
    type: 'OPEN_BOX';
    originSealedBoxId: string;
    unitsPerBox: number;
    remainingUnits: number;
}

export interface LooseUnits extends BaseStockContainer {
    type: 'LOOSE_UNITS';
    quantityUnits: number;
    originOpenBoxId?: string;
    originSealedBoxId?: string;
    origin: 'RETURN_PATIENT' | 'RETURN_SERVICE' | 'ADJUSTMENT' | 'DISPENSATION' | 'CONSUMPTION';
}

export type StockContainer = SealedBox | OpenBox | LooseUnits;

// --- LEDGERS ---
// Ideally these are mapped in the DB structure, but we define the types here for Typescript

export interface ServiceLedger {
    [serviceId: string]: StockContainer[];
}

export interface AdmissionLedger {
    [admissionId: string]: StockContainer[];
}

// --------------------------------------------------------

/**
 * @deprecated Legacy Inventory Item. Migrating to Container-based Ledgers.
 */
export interface InventoryItem {
    id: string;
    productId: string;
    name: string;
    category: ItemCategory;
    serviceId?: string; 
    location: string;
    batchNumber: string;
    expiryDate: string;
    unitPrice: number;
    theoreticalQty: number;
    actualQty: number | null;
    lastUpdated?: Date;
    tenantId?: string; // New: Tenant Isolation
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
    margin?: number;
    vat?: number;
    isDefault?: boolean;
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
    source?: 'GLOBAL' | 'TENANT';
    tenantId?: string;
}

export interface Molecule {
    id: string;
    name: string;
    dosage?: number;
    dosageUnit?: DosageUnit;
}


export type DosageUnit = 'g' | 'mg' | 'ml';

export interface ProductDCI {
    dciId: string;
    dosage: number;
    unit: string;
    name?: string; // Enriched
    atcCode?: string; // Enriched
}

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
    dciIds?: string[];                  // NOUVEAU: Références aux DCIs globales (Obligatoire pour Médicament)
    molecules?: never;                  // DEPRECATED/REMOVED
    dosage?: number;
    dosageUnit?: DosageUnit;
    therapeuticClass?: string;
    createdAt: Date;
    updatedAt: Date;
    tenantId?: string;
    isEnabled: boolean;
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
    tenantId?: string;
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
    tenantId?: string;
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
    processedBy?: string;
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
    tenantId?: string;
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
        targetLocationId?: string; // Where it should be stored in the service
        productDispensedId?: string; // If substitution occurred
        productDispensedName?: string;
        dispensedBatches?: {
            batchNumber: string;
            expiryDate: string;
            quantity: number;
            productId?: string;
            productName?: string;
            dispensedAs?: 'BOX' | 'UNIT'; // MANDATORY: Track how it was dispensed
        }[];
    }[];
    targetServiceId?: string; // Optional: Service ID (if multiple services supported in future)
    serviceId?: string; // ID of the requesting service
    createdAt: Date;
    updatedAt: Date;
    tenantId?: string;
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
    tenantId?: string;
}

// --- 🏗 TRACEABILITY LOGS ---

export type MovementReason = 'REPLENISHMENT' | 'PRESCRIPTION' | 'RETURN' | 'CONSUMPTION' | 'DESTRUCTION' | 'INTERNAL_TRANSFER' | 'ADJUSTMENT';

export type SelectionMode = 'FEFO' | 'SCAN' | 'MANUAL';

export interface MovementLog {
    id: string;
    timestamp: string;
    productId: string;
    lot: string;
    containerId: string;
    originSealedBoxId?: string;
    
    fromLedger: string; // "PHARMACY", "SERVICE:xxx", "ADMISSION:xxx", "SUPPLIER", "VOID"
    toLedger: string;
    
    quantityUnits: number | null; // Null for whole boxes
    
    reason: MovementReason;
    selectionMode: SelectionMode;
    actorUserId: string;
    tenantId?: string;
}
