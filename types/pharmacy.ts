
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
  type?: 'PHYSICAL' | 'VIRTUAL';
  scope?: 'PHARMACY' | 'SERVICE';
  serviceId?: string;
  locationClass?: 'COMMERCIAL' | 'CHARITY';
  valuationPolicy?: 'VALUABLE' | 'NON_VALUABLE';
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
  reservedUnits?: number;           // Active reservations (basket/transfer)
  pendingReturnUnits?: number;      // Declared but not yet received returns
  availableUnits?: number;          // Effective available: theoreticalQty - reserved - pendingReturn
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
  salePriceHT?: number;
  salePriceTTC?: number;
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
    atcCode?: string;
    synonyms?: string[];
    therapeuticClass?: string;
    careCategoryId?: string;
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
  | 'ng/mL' | 'mcg/mL' | 'mg/mL' | 'g/L' | 'g/mL' | 'IU/mL' | 'mIU/mL' | 'U/mL' | 'mmol/L' | 'µmol/L' | 'mEq/L' | 'mEq' | 'mOsm'
  | 'mol' | 'mmol' | 'µmol' | 'nmol'
  | '%'
  | 'mg/kg' | 'mcg/kg' | 'IU/kg' | 'mg/kg/day' | 'mcg/kg/day' | 'µg/kg' | 'UI/kg' | 'mmol/kg'
  | 'mg/m²' | 'mcg/m²' | 'µg/m²'
  | 'mcg/dose' | 'mg/dose' | 'g/dose' | 'mL/dose' | 'dose(s)'
  | 'L' | 'µL' | 'mL' | 'ml'
  | 'mg/h' | 'µg/kg/min' | 'mg/kg/h' | 'mL/min' | 'mL/kg/h' | 'UI/h' | 'UI/kg/h' | 'mg/min' | 'UI/min'
  | 'gouttes (drops / gtt)' | 'sachet(s)' | 'ampoule(s)' | 'flacon(s)' | 'poche(s)' | 'spray(s)' | 'application(s)' | 'patch(s)' | 'suppositoire(s)' | 'ovule(s)' | 'unité(s)' | 'comprimés' | 'gélules' | 'bouffées';

export enum UnitType {
  BOX = 'Boîte',
  UNIT = 'Unité'
}

export interface ProductDCIComponent {
  dciId: string;
  name?: string; // Enriched by backend
  atcCode?: string; // Enriched by backend
  amount_value: number;
  amount_unit_id: string;
  diluent_volume_value?: number;
  diluent_volume_unit_id?: string;
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

  defaultPrescUnit?: string;
  defaultPrescRoute?: string;

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
  DRAFT = 'DRAFT',
  ORDERED = 'ORDERED',
  PARTIAL = 'PARTIAL',
  COMPLETED = 'COMPLETED'
}

export interface POItem {
  productId: string;
  orderedQty: number;
  deliveredQty: number;
  unitPrice?: number; // Added for Transactional Pricing
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
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED'
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
    destination_location_id?: string;
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