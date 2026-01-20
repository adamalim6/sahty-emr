
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
  tenantId?: string;
  scope?: 'PHARMACY' | 'SERVICE';
  serviceId?: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  name: string;
  category: ItemCategory;
  location: string;
  serviceId?: string; // Identifier for service-specific stock (e.g., 'SERVICE_DEFAULT')
  batchNumber: string;
  expiryDate: string;
  unitPrice: number;
  theoreticalQty: number;
  actualQty: number | null;
  lastUpdated?: Date;
  tenantId?: string;
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

export interface PriceVersion {
  id: string;
  purchasePrice: number;
  margin: number;
  vat: number;
  salePriceHT: number;
  salePriceTTC: number;
  validFrom: string;
  validTo: string | null;
  createdBy?: string; // User Name or ID
  reason?: string;    // Modification Motif
}

export interface ProductSupplier { // Renamed from Supplier to avoid collision, or keep as sub-interface
  id: string;
  name: string;
  purchasePrice: number;
  isActive: boolean;
  margin?: number;
  vat?: number;
  isDefault?: boolean;
  priceVersions: PriceVersion[];
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

export interface DCI {
    id: string;
    name: string;
    atc_code?: string;
    synonyms?: string[];
    therapeutic_class?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Molecule {
  id: string;
  name: string;
}

export type DosageUnit = 
  | 'ng' | 'mcg' | 'mg' | 'g' | 'kg'
  | 'IU' | 'mIU' | 'kIU' | 'U' | 'mU' | 'kU'
  | 'ng/mL' | 'mcg/mL' | 'mg/mL' | 'g/L' | 'g/mL' | 'IU/mL' | 'mIU/mL' | 'U/mL' | 'mmol/L' | 'µmol/L' | 'mEq/L'
  | 'mol' | 'mmol' | 'µmol' | 'nmol'
  | '%'
  | 'mg/kg' | 'mcg/kg' | 'IU/kg' | 'mg/kg/day' | 'mcg/kg/day'
  | 'mg/m²' | 'mcg/m²'
  | 'mcg/dose' | 'mg/dose' | 'g/dose' | 'mL/dose'
  | 'ml';

export enum UnitType {
  BOX = 'Boîte',
  UNIT = 'Unité'
}

export interface ProductDCIComponent {
  dciId: string;
  name?: string; // Enriched by backend
  atcCode?: string; // Enriched by backend
  dosage: number;
  unit: DosageUnit;
  // For complex dosages like "15mg / 5ml"
  // dosage would be 3, unit 'mg/mL'
  presentation?: {
    numerator: number;       // 15
    numeratorUnit: string;   // 'mg'
    denominator: number;     // 5
    denominatorUnit: string; // 'ml'
  };
}

export interface ProductDefinition {
  id: string;
  sahtyCode: string;  // NOUVEAU: Code généré automatiquement par le système
  code?: string;      // CIP/EAN/GTIN - Désormais optionnel
  name: string;
  type: ProductType;
  unit: UnitType;       // 'Boîte' or 'Unité'
  unitsPerBox: number;  // Standard packing
  description?: string; // Optional, removed from UI
  
  // Nouveaux champs pour import Maroc
  form?: string;          // Forme Galénique
  presentation?: string;  // Conditionnement (ex: "BOITE DE 30")
  brandName?: string;     // Spécialité (Nom commercial)
  marketInfo?: {
    ppv?: number;
    ph?: number;
    pfht?: number;
  };

  manufacturer?: string;
  suppliers: ProductSupplier[];
  profitMargin: number;
  vatRate: number;
  isSubdivisable: boolean;
  subdivisionUnits?: number;          // DEPRECATED
  dciIds?: string[];                  // DEPRECATED? Keep for backward compat?
  dciComposition?: ProductDCIComponent[]; // NEW: Detailed composition
  molecules?: never;                  // DEPRECATED/REMOVED
  dosage?: number;
  dosageUnit?: DosageUnit;
  therapeuticClass?: string;
  createdAt: Date;
  updatedAt: Date;
  currentStock?: number;
  isEnabled?: boolean; // Merged flag
  tenantId?: string;   // Merged flag
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
  quantity: number;           // MODIFIÉ: en nombre de boîtes
  locationId: string;
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
  processedBy?: string; // NOUVEAU: Nom de l'utilisateur ayant validé
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

export enum PackStatus {
  ACTIVE = 'Active',
  SEALED = 'Scellée',
  OPENED = 'Entamée',
  EMPTY = 'Vide',
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
  id: string; // Internal ID
  serialNumber: string; // Human readable unique SN (e.g. SN-123456)
  productId: string;
  batchNumber: string; // Renamed from lotNumber for consistency
  expiryDate: string;
  locationId: string;
  status: PackStatus;
  unitsPerPack: number;
  remainingUnits: number;
  history: PackHistoryEvent[];
  createdAt: string;
  tenantId?: string;
}

export interface DispensedItem {
  id: string;
  prescriptionId: string;
  productId: string;
  productName?: string;
  serialNumber?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  mode: 'UNIT' | 'FULL_PACK';
  dispensedAt: string;
  dispensedBy: string;
  totalPriceInclVAT: number;
  unitPriceExclVAT: number;
  vatRate: number;
}

export interface PatientWithPrescriptions {
  id: string;
  firstName: string;
  lastName: string;
  ipp: string;
  dateOfBirth: string;
  gender: string;
  cin?: string;
  prescriptionCount: number;
  lastPrescriptionDate?: string;
}

export enum ReplenishmentStatus {
  PENDING = 'En Attente',
  IN_PROGRESS = 'En Cours',
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
    targetLocationId?: string;
    productDispensedId?: string;
    productDispensedName?: string;
    dispensedBatches?: {
      batchNumber: string;
      quantity: number;
      expiryDate: string;
      productId?: string;
      productName?: string;
    }[];
  }[];
  createdAt: string; // JSON date string
  updatedAt: string;
  tenantId?: string;
  serviceId?: string;
}

export interface LooseUnitItem {
    id: string;
    productId: string;
    batchNumber: string;
    expiryDate: string;
    locationId: string;
    quantity: number;
    tenantId?: string;
}