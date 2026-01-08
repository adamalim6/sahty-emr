
import {
    InventoryItem, ItemCategory, ProductDefinition, ProductType, StockLocation,
    PartnerInstitution, StockOutTransaction, StockOutType, DestructionReason,
    PurchaseOrder, DeliveryNote, QuarantineSessionResult, PharmacySupplier,
    ReplenishmentRequest, ReplenishmentStatus
} from '../models/pharmacy';
import { Dispensation, SerializedPack, PackStatus, DispensationMode, LooseUnitItem } from '../models/serialized-pack';
import { serializedPackService } from './serializedPackService';
import { dispensationService } from './dispensationService';
import { emrService } from './emrService';
import { AdmissionMedicationConsumption } from '../models/emr';
import * as fs from 'fs';
import * as path from 'path';
import { ProductVersion } from '../models/product-version';


const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'pharmacy_db.json');
const GLOBAL_SUPPLIERS_FILE = path.join(DATA_DIR, 'global_suppliers.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MOCK_LOCATION_NAMES = ['Étagère A-1', 'Étagère A-2', 'Réfrigérateur 1', 'Armoire Sécurisée', 'Réserve Vrac B'];

const PRODUCTS_DB = [
    { id: 'PROD-001', name: 'Amoxicilline 500mg Gélules', category: ItemCategory.ANTIBIOTICS, price: 0.15 },
    { id: 'PROD-002', name: 'Paracétamol 1g IV', category: ItemCategory.ANALGESICS, price: 2.50 },
    { id: 'PROD-003', name: 'Atorvastatine 20mg', category: ItemCategory.CARDIAC, price: 0.45 },
    { id: 'PROD-004', name: 'Sérum Salé 0.9% 1L', category: ItemCategory.FLUIDS, price: 1.20 },
    { id: 'PROD-005', name: 'Gants Chirurgicaux 7.5', category: ItemCategory.CONSUMABLES, price: 0.30 },
    { id: 'PROD-006', name: 'Sulfate de Morphine 10mg/ml', category: ItemCategory.CONTROLLED, price: 4.00 },
    { id: 'PROD-007', name: 'Ceftriaxone 1g Inj', category: ItemCategory.ANTIBIOTICS, price: 3.10 },
    { id: 'PROD-008', name: 'Patch Fentanyl 25mcg', category: ItemCategory.CONTROLLED, price: 12.50 },
    { id: 'PROD-009', name: 'Aspirine 75mg', category: ItemCategory.CARDIAC, price: 0.05 },
    { id: 'PROD-010', name: 'Seringue 10ml', category: ItemCategory.CONSUMABLES, price: 0.10 },
];

export class PharmacyService {
    private inventory: InventoryItem[] = [];
    private catalog: ProductDefinition[] = [];
    private locations: StockLocation[] = [];
    private partners: PartnerInstitution[] = [];
    private stockOutHistory: StockOutTransaction[] = [];
    private productVersions: ProductVersion[] = []; // Version storage
    private purchaseOrders: PurchaseOrder[] = [];
    private deliveryNotes: DeliveryNote[] = [];
    private serializedPacks: SerializedPack[] = [];
    private looseUnits: LooseUnitItem[] = []; // NEW: Loose units storage
    private dispensations: Dispensation[] = [];
    private suppliers: PharmacySupplier[] = [];     // Tenant-local suppliers
    private globalSuppliers: PharmacySupplier[] = []; // Global suppliers (read-only)
    private replenishmentRequests: ReplenishmentRequest[] = [];
    private static instance: PharmacyService;


    constructor() {
        this.loadData();

        // If catalog is empty, it means no data loaded or empty file
        if (this.catalog.length === 0) {
            // Disabled default seeding for manual entry
            /*
            // Initialize Catalog
            this.catalog = PRODUCTS_DB.map(p => ({
                id: p.id,
                name: p.name,
                type: (p.id.includes('005') || p.id.includes('010')) ? ProductType.CONSUMABLE : ProductType.DRUG,
                isSubdivisable: true,
                unitsPerPack: 10,
                minStock: 10,
                currentStock: 0,
                suppliers: [{ id: 'SUP-001', name: 'Afric-Phar', purchasePrice: p.price, leadTimeDays: 2, isActive: true }],
                vatRate: 20,
                profitMargin: 30,
                createdAt: new Date(),
                updatedAt: new Date(),
                description: p.name
            }));

            // Initialize Locations
            if (this.locations.length === 0) {
                this.locations = MOCK_LOCATION_NAMES.map((name, index) => ({
                    id: `LOC-${100 + index}`,
                    name: name,
                    type: name.includes('Réfrigérateur') ? 'FRIDGE' : 'SHELF',
                    description: 'Zone de stockage principale',
                    temperature: name.includes('Réfrigérateur') ? '2-8°C' : 'Ambiante',
                    isActive: true
                }));
            }


            // Initialize Default Supplier
            if (this.suppliers.length === 0) {
                this.suppliers.push({
                    id: 'SUP-001',
                    name: 'Afric-Phar',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                    address: 'Casablanca, Maroc',
                    contactPerson: 'M. Alami',
                    phone: '+212 5 22 00 00 00'
                });
            }

            this.saveData();
            */
        }
    }

    public static getInstance(): PharmacyService {
        if (!PharmacyService.instance) {
            PharmacyService.instance = new PharmacyService();
        }
        return PharmacyService.instance;
    }

    private saveData() {
        try {
            const data = {
                inventory: this.inventory,
                catalog: this.catalog,
                locations: this.locations,
                partners: this.partners,
                stockOutHistory: this.stockOutHistory,
                purchaseOrders: this.purchaseOrders,
                deliveryNotes: this.deliveryNotes,
                serializedPacks: serializedPackService.getAllPacks(), // Pull valid state from service
                dispensations: this.dispensations,
                suppliers: this.suppliers,
                replenishmentRequests: this.replenishmentRequests,
                looseUnits: this.looseUnits, // Persist Loose Units
                productVersions: this.productVersions
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error("Error saving pharmacy data:", error);
        }
    }

    private loadData() {
        try {
            if (fs.existsSync(DB_FILE)) {
                const raw = fs.readFileSync(DB_FILE, 'utf-8');
                const data = JSON.parse(raw);
                this.inventory = data.inventory || [];
                this.catalog = (data.catalog || []).map((p: any) => ({
                    ...p,
                    createdAt: new Date(p.createdAt),
                    updatedAt: new Date(p.updatedAt)
                }));
                this.locations = data.locations || [];
                this.partners = data.partners || [];
                this.stockOutHistory = (data.stockOutHistory || []).map((h: any) => ({
                    ...h,
                    date: new Date(h.date)
                }));
                this.purchaseOrders = (data.purchaseOrders || []).map((p: any) => ({
                    ...p,
                    date: new Date(p.date)
                }));
                this.deliveryNotes = (data.deliveryNotes || []).map((n: any) => ({
                    ...n,
                    date: new Date(n.date)
                }));
                this.serializedPacks = (data.serializedPacks || []).map((p: any) => ({
                    ...p,
                    createdAt: new Date(p.createdAt)
                }));
                this.looseUnits = data.looseUnits || []; // Load Loose Units
                this.dispensations = (data.dispensations || []).map((d: any) => ({
                    ...d,
                    dispensedAt: new Date(d.dispensedAt)
                }));
                this.replenishmentRequests = (data.replenishmentRequests || []).map((r: any) => ({
                    ...r,
                    createdAt: new Date(r.createdAt),
                    updatedAt: new Date(r.updatedAt)
                }));
                this.productVersions = (data.productVersions || []).map((v: any) => ({
                    ...v,
                    createdAt: new Date(v.createdAt)
                }));
                this.suppliers = (data.suppliers || []).map((s: any) => ({
                    ...s,
                    createdAt: new Date(s.createdAt),
                    updatedAt: new Date(s.updatedAt)
                }));
                console.log(`[PharmacyService] Loaded ${this.catalog.length} products from DB.`);
                console.log(`[PharmacyService] Loaded ${this.suppliers.length} suppliers from DB.`);
                
                // Inject loaded packs into the Pack Service (Single Source of Truth)
                if (this.serializedPacks.length > 0) {
                    serializedPackService.setPacks(this.serializedPacks);
                    console.log(`[PharmacyService] Injected ${this.serializedPacks.length} packs into SerializedPackService.`);
                } else {
                     // Check if we need to seed initial mock data IF EMPTY?
                     // No, let's keep it persistent. If empty, it's empty.
                }

            } else {
                console.log("[PharmacyService] No DB file found. Starting empty.");
            }

            // Load Global Suppliers
            if (fs.existsSync(GLOBAL_SUPPLIERS_FILE)) {
                const raw = fs.readFileSync(GLOBAL_SUPPLIERS_FILE, 'utf-8');
                const globalData = JSON.parse(raw);
                this.globalSuppliers = globalData.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    contactPerson: 'Fournisseur Global',
                    isActive: s.is_active,
                    createdAt: new Date(s.created_at || new Date()),
                    updatedAt: new Date(s.updated_at || new Date()),
                    source: 'GLOBAL'
                }));
                 console.log(`[PharmacyService] Loaded ${this.globalSuppliers.length} global suppliers.`);
            }
        } catch (error) {
            console.error("[PharmacyService] Error loading pharmacy data:", error);
        }
    }

    // Loose Units Management
    getLooseUnits(productId?: string, serviceId?: string): LooseUnitItem[] {
        let result = this.looseUnits;
        
        if (productId) {
            result = result.filter(u => u.productId === productId);
        }
        
        if (serviceId) {
             result = result.filter(u => u.serviceId === serviceId);
        }

        return result;
    }

    addLooseUnits(item: LooseUnitItem) {
        // Try to merge with existing batch/location if exists
        const existing = this.looseUnits.find(u => 
            u.productId === item.productId && 
            u.batchNumber === item.batchNumber && 
            u.locationId === item.locationId &&
            u.expiryDate === item.expiryDate
        );

        if (existing) {
            existing.quantity += item.quantity;
        } else {
            if (!item.id) item.id = `LOOSE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            this.looseUnits.push(item);
        }
        this.saveData();
    }

    removeLooseUnits(productId: string, quantity: number): number {
        // Validation: Prevent negative quantity (which would increment stock)
        if (quantity < 0) throw new Error("Cannot remove negative quantity.");
        if (quantity === 0) return 0;

        // FEFO removal logic for internal usage (simple)
        // Returns actual quantity removed
        let remainingToRemove = quantity;
        
        const relevantUnits = this.looseUnits
            .filter(u => u.productId === productId)
            .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        for (const unit of relevantUnits) {
            if (remainingToRemove <= 0) break;
            
            if (unit.quantity <= remainingToRemove) {
                // Consume full unit item
                remainingToRemove -= unit.quantity;
                this.looseUnits = this.looseUnits.filter(u => u.id !== unit.id);
            } else {
                // Partial consume
                unit.quantity -= remainingToRemove;
                remainingToRemove = 0;
            }
        }
        this.saveData();
        return quantity - remainingToRemove;
    }

    // Getters and Setters
    getInventory(tenantId?: string, serviceId?: string): InventoryItem[] {
        let items = this.inventory;
        if (tenantId) {
             items = items.filter(item => !item.tenantId || item.tenantId === tenantId);
        }
        if (serviceId) {
             items = items.filter(item => item.serviceId === serviceId);
        }
        return items;
    }

    getCatalog(tenantId?: string): ProductDefinition[] {
        // Calculate live stock from serialized packs (SSOT)
        const allPacks = serializedPackService.getAllPacks();
        
        let products = this.catalog;
        if (tenantId) {
            products = products.filter(p => !p.tenantId || p.tenantId === tenantId);
        }

        return products.map(product => {
            const activePacks = allPacks.filter(p =>
                p.productId === product.id &&
                (p.status === PackStatus.SEALED || p.status === PackStatus.OPENED)
            );

            const looseItems = this.looseUnits.filter(u => u.productId === product.id);
            const looseQty = looseItems.reduce((acc, u) => acc + u.quantity, 0);

            // Calculate total units available
            const packsQty = activePacks.reduce((sum, pack) => sum + (pack.remainingUnits || pack.unitsPerPack), 0);
            const totalUnits = packsQty + looseQty;

            // We can also calculate full boxes
            const fullBoxes = activePacks.filter(p => p.status === PackStatus.SEALED).length;

            return {
                ...product,
                currentStock: totalUnits, // NOW GLOBAL TOTAL UNITS (Sealed + Open + Loose)
                // Additional stats could be attached if ProductDefinition supported them (e.g. detailed breakdown)
                // But for standard `currentStock` usage, total units is the safest "Active Inventory" metric.
            };
        });
    }

    addProduct(product: ProductDefinition) {
        // Assign tenant scoping if passed (via controller)
        if (!product.id) {
            product.id = `PROD-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`;
        }
        this.catalog.push(product);
        this.saveData();
        return product;
    }

    updateProduct(product: ProductDefinition): ProductDefinition {
        const index = this.catalog.findIndex(p => p.id === product.id);
        if (index !== -1) {
            // Strict Tenant Check if tenantId is provided in update request (optional safety)
            const existing = this.catalog[index];
            if (product.tenantId && existing.tenantId && product.tenantId !== existing.tenantId) {
                throw new Error("Accès refusé : Ce produit appartient à un autre tenant.");
            }
            
            this.catalog[index] = { ...product, updatedAt: new Date() };
            this.saveData();
            return this.catalog[index];
        }
        throw new Error(`Product with ID ${product.id} not found.`);
    }

    getLocations(tenantId?: string, serviceId?: string, scope?: 'PHARMACY' | 'SERVICE'): StockLocation[] {
         let locs = this.locations;
         
         // 1. Filter by Tenant
         if (tenantId) {
             locs = locs.filter(l => !l.tenantId || l.tenantId === tenantId);
         }

         // 2. Strict Scope Filtering
         if (scope === 'PHARMACY') {
             // Pharmacy emplacements MUST NOT have a serviceId (or if they do, ignore them? No, rule is strict separate)
             // We return only those marked as PHARMACY or (legacy) those without serviceId.
             // Given migration script ran, we rely on 'scope' field mostly, butfallback to no serviceId.
             locs = locs.filter(l => l.scope === 'PHARMACY' || (!l.scope && !l.serviceId));
         } else if (scope === 'SERVICE') {
             // Service emplacements MUST have a serviceId matching the request
             // if (!serviceId) {
             //    // Return [] if no serviceId provided for SERVICE scope to avoid leaking
             //    return [];
             // }
             if (serviceId) {
                locs = locs.filter(l => (l.scope === 'SERVICE' || !l.scope) && l.serviceId === serviceId);
             } else {
                // Return ALL service locations
                locs = locs.filter(l => l.scope === 'SERVICE' || (l.serviceId && !l.scope));
             }
         } else {
             // If no scope provided (legacy calls?), we might want to be careful.
             // If serviceId is provided, imply SERVICE scope.
             if (serviceId) {
                 locs = locs.filter(l => l.serviceId === serviceId);
             } else {
                 // Return PHARMACY locations by default if no serviceId? 
                 // Or return everything? Let's return PHARMACY only to be safe for "Pharmacy Module" old calls
                 locs = locs.filter(l => !l.serviceId || l.scope === 'PHARMACY');
             }
         }
         
         return locs;
    }

    addLocation(location: StockLocation) {
        if (!location.id) {
            location.id = `LOC-${Date.now()}`;
        }
        
        // Strict Validation
        if (location.scope === 'PHARMACY') {
            if (location.serviceId) throw new Error("Pharmacy locations cannot belong to a service.");
        } else if (location.scope === 'SERVICE') {
            if (!location.serviceId) throw new Error("Service locations must belong to a service.");
        } else {
            // Infer scope if missing
            if (location.serviceId) location.scope = 'SERVICE';
            else location.scope = 'PHARMACY';
        }

        this.locations.push(location);
        this.saveData();
        return location;
    }

    updateLocation(location: StockLocation): StockLocation {
        const index = this.locations.findIndex(l => l.id === location.id);
        if (index !== -1) {
            const existing = this.locations[index];
            
            // Scope immutability check? better safe than sorry
            if (existing.scope && location.scope && existing.scope !== location.scope) {
                 throw new Error("Cannot change location scope.");
            }

            // Merge
            const updated = { ...existing, ...location };
            
            // Re-validate
             if (updated.scope === 'PHARMACY' && updated.serviceId) {
                 throw new Error("Pharmacy locations cannot have serviceId.");
             }
             if (updated.scope === 'SERVICE' && !updated.serviceId) {
                 throw new Error("Service locations must have serviceId.");
             }

            this.locations[index] = updated;
            this.saveData();
            return this.locations[index];
        }
        throw new Error(`Location with ID ${location.id} not found.`);
    }

    deleteLocation(id: string): void {
        const initialLength = this.locations.length;
        this.locations = this.locations.filter(l => l.id !== id);
        if (this.locations.length === initialLength) {
            throw new Error(`Location with ID ${id} not found.`);
        }
        this.saveData();
    }



    // Supplier Management
    getSuppliers(tenantId?: string): PharmacySupplier[] {
        // Merge Tenant and Global suppliers at response level
        // READ-ONLY separation is enforced by 'source' property
        let tenantSuppliers = this.suppliers.map(s => ({ ...s, source: 'TENANT' as const }));

        // Filter by Tenant ID if permitted (strict isolation)
        if (tenantId) {
            tenantSuppliers = tenantSuppliers.filter(s => s.tenantId === tenantId);
        }
        
        // Ensure globals are marked properly (already done in loadData but double check safety)
        const globalSuppliersSafe = this.globalSuppliers.map(s => ({ ...s, source: 'GLOBAL' as const }));
        
        return [...tenantSuppliers, ...globalSuppliersSafe];
    }

    addSupplier(supplier: PharmacySupplier) {
        if (!supplier.id) {
            supplier.id = `SUP-${Date.now()}`;
        }
        supplier.createdAt = new Date();
        supplier.updatedAt = new Date();
        supplier.source = 'TENANT'; // Force Tenant Source for all new creations
        
        this.suppliers.push(supplier);
        this.saveData();
        return supplier;
    }

    updateSupplier(supplier: PharmacySupplier): PharmacySupplier {
        // 1. Check if it is a Global Supplier -> BLOCK
        const isGlobal = this.globalSuppliers.some(s => s.id === supplier.id);
        if (isGlobal || supplier.source === 'GLOBAL') {
            throw new Error("Action interdite : Impossible de modifier un fournisseur global (Read-Only).");
        }

        // 2. Find and Update Tenant Supplier
        const index = this.suppliers.findIndex(s => s.id === supplier.id);
        if (index !== -1) {
            this.suppliers[index] = { 
                ...supplier, 
                updatedAt: new Date(), 
                source: 'TENANT' // Ensure it remains Tenant
            };
            this.saveData();
            return this.suppliers[index];
        }
        
        throw new Error(`Fournisseur introuvable (ID: ${supplier.id}).`);
    }

    deleteSupplier(id: string): void {
        // 1. Check if it is a Global Supplier -> BLOCK
        const isGlobal = this.globalSuppliers.some(s => s.id === id);
        if (isGlobal) {
            throw new Error("Action interdite : Impossible de supprimer un fournisseur global (Read-Only).");
        }

        const initialLength = this.suppliers.length;
        this.suppliers = this.suppliers.filter(s => s.id !== id);
        
        if (this.suppliers.length === initialLength) {
            throw new Error(`Fournisseur introuvable (ID: ${id}).`);
        }
        this.saveData();
    }

    getPartners(tenantId?: string): PartnerInstitution[] {
        let items = this.partners;
        if (tenantId) {
            items = items.filter(p => !p.tenantId || p.tenantId === tenantId);
        }
        return items;
    }

    addPartner(partner: PartnerInstitution) {
        if (!partner.id) {
            partner.id = `PART-${Date.now()}`;
        }
        this.partners.push(partner);
        this.saveData();
        return partner;
    }

    updatePartner(partner: PartnerInstitution): PartnerInstitution {
        const index = this.partners.findIndex(p => p.id === partner.id);
        if (index !== -1) {
             // Strict Tenant Check
            const existing = this.partners[index];
            if (partner.tenantId && existing.tenantId && partner.tenantId !== existing.tenantId) {
                throw new Error("Accès refusé : Ce partenaire appartient à un autre tenant.");
            }
            this.partners[index] = { ...existing, ...partner };
            this.saveData();
            return this.partners[index];
        }
        throw new Error(`Partner with ID ${partner.id} not found.`);
    }

    deletePartner(id: string, tenantId?: string): void {
        const index = this.partners.findIndex(p => p.id === id);
        if (index !== -1) {
            const partner = this.partners[index];
            if (tenantId && partner.tenantId && partner.tenantId !== tenantId) {
                throw new Error("Accès refusé : Impossible de supprimer ce partenaire (Tenant Mismatch).");
            }
            this.partners.splice(index, 1);
            this.saveData();
            return;
        }
        throw new Error(`Partner with ID ${id} not found.`);
    }

    // PO & Delivery Management
    createPurchaseOrder(po: PurchaseOrder) {
        if (!po.id) {
             po.id = `PO-${Date.now()}`;
        }
        this.purchaseOrders.push(po);
        this.saveData();
        return po;
    }

    getPurchaseOrders(tenantId?: string) {
        let pos = this.purchaseOrders;
        if (tenantId) {
            pos = pos.filter(p => !p.tenantId || p.tenantId === tenantId);
        }
        return pos;
    }

    createDeliveryNote(note: DeliveryNote) {
        if (!note.id) {
            note.id = `DN-${Date.now()}`;
        }
        this.deliveryNotes.push(note);

        // Update linked PO
        const po = this.purchaseOrders.find(p => p.id === note.poId);
        if (po) {
            note.items.forEach(noteItem => {
                const poItem = po.items.find(i => i.productId === noteItem.productId);
                if (poItem) {
                    poItem.deliveredQty += noteItem.deliveredQty;
                }
            });

            // Update PO Status
            const allComplete = po.items.every(i => i.deliveredQty >= i.orderedQty);
            const someDelivered = po.items.some(i => i.deliveredQty > 0);

            if (allComplete) po.status = 'Terminé' as any;
            else if (someDelivered) po.status = 'Partiel' as any;
        }

        this.saveData();
        return note;
    }

    getDeliveryNotes(tenantId?: string) {
        console.log(`[Service] getDeliveryNotes for tenant: ${tenantId}`);
        let notes = this.deliveryNotes;
        if (tenantId) {
            notes = notes.filter(n => {
                const match = !n.tenantId || n.tenantId === tenantId;
                if (!match) console.log(`[Service] Hiding Note ${n.id} (Tenant: ${n.tenantId}) from ${tenantId}`);
                return match;
            });
        } else {
             console.log(`[Service] No tenantId provided, returning all notes.`);
        }
        return notes;
    }

    getStockOutHistory(): StockOutTransaction[] {
        return this.stockOutHistory;
    }

    getProductById(productId: string): ProductDefinition | undefined {
        return this.catalog.find(p => p.id === productId);
    }

    // Process Quarantine (Logic for connecting dots)
    processQuarantine(result: QuarantineSessionResult) {
        // 1. Update Delivery Note Status
        const note = this.deliveryNotes.find(n => n.id === result.noteId);
        if (note) {
            note.status = 'Traité' as any; // ProcessingStatus.PROCESSED
            note.processingResult = result;
        }

        // 2. Generate Serialized Packs & Update Inventory
        result.items.forEach(procItem => {
            const product = this.getProductById(procItem.productId);
            if (!product) return;

            // Map ProductType to ItemCategory
            let category = ItemCategory.CONSUMABLES;
            if (product.type === ProductType.DRUG) {
                category = ItemCategory.ANTIBIOTICS; // Default fallback
            }

            procItem.batches.forEach(batch => {
                if (batch.quantity <= 0) return;

                // Create Serialized Packs via Service
                const newPacks = serializedPackService.createPacksFromBatch({
                    productId: procItem.productId,
                    lotNumber: batch.batchNumber,
                    expiryDate: batch.expiryDate,
                    locationId: batch.locationId,
                    quantityInPacks: batch.quantity,
                    unitsPerPack: product.unitsPerPack || 1,
                    deliveryNoteId: result.noteId
                });

                // Assign Tenant ID explicitly
                const note = this.deliveryNotes.find(n => n.id === result.noteId);
                const tenantId = note?.tenantId;

                newPacks.forEach(p => p.tenantId = tenantId);

                // Add new packs to main storage
                this.serializedPacks.push(...newPacks);

                // Update Aggregate Inventory (InventoryItem)
                const inventoryId = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                const totalUnits = batch.quantity * (product.unitsPerPack || 1);

                // Check if existing line for same batch/location/product
                const existingItem = this.inventory.find(i =>
                    i.productId === procItem.productId &&
                    i.batchNumber === batch.batchNumber &&
                    i.location === batch.locationId &&
                    (!i.tenantId || i.tenantId === tenantId)
                );

                if (existingItem) {
                    existingItem.theoreticalQty += totalUnits;
                    existingItem.lastUpdated = new Date();
                } else {
                    this.inventory.push({
                        id: inventoryId,
                        productId: procItem.productId,
                        name: product.name,
                        category: category,
                        location: batch.locationId,
                        batchNumber: batch.batchNumber,
                        expiryDate: batch.expiryDate,
                        unitPrice: (product.suppliers[0]?.purchasePrice || 0) / (product.unitsPerPack || 1),
                        theoreticalQty: totalUnits,
                        actualQty: null,
                        lastUpdated: new Date(),
                        tenantId: tenantId // Persist Tenant
                    });
                }
            });
        });

        this.saveData();
        return { success: true };
    }

    // Process Validated Return (Called by ReturnService)
    public processValidatedReturn(params: {
        productId: string,
        batchNumber: string,
        expiryDate: string,
        quantity: number, // Units
        condition: 'SEALED' | 'OPENED',
        isBox: boolean,
        serialNumber?: string
    }) {
        const { productId, batchNumber, expiryDate, quantity, condition, isBox, serialNumber } = params;
        const productDef = this.getProductById(productId);
        if (!productDef) return;

        // 1. Determine Location (Restocking)
        // Ideally, find where this batch is already stored in Pharmacy
        const existingInv = this.inventory.find(i =>
            i.productId === productId &&
            i.batchNumber === batchNumber &&
            !i.serviceId // Strict Pharmacy
        );
        const targetLocation = existingInv ? existingInv.location : this.locations[0]?.id || 'PHARMACY_DEFAULT';

        // 2. Update Serialized Packs (if Box)
        if (isBox && serialNumber) {
            // Check if pack exists (it should if it was dispensed)
            let pack = this.serializedPacks.find(p => p.id === serialNumber || p.serialNumber === serialNumber);

            if (pack) {
                // Reactivate Pack
                pack.status = condition === 'SEALED' ? PackStatus.SEALED : PackStatus.OPENED;
                pack.locationId = targetLocation;
                pack.remainingUnits = quantity; // Reset if sealed, or partial if opened? 

                pack.history.push({
                    date: new Date().toISOString(),
                    action: 'RETURN_RESTOCK',
                    userId: 'SYSTEM',
                    details: 'Restocked from validated return'
                });
            } else {
                // Create new Pack (e.g. if it was lost or legacy)
                const newPack: SerializedPack = {
                    id: serialNumber, // Use serial as ID if new, or generate? Better generate internal ID.
                    serialNumber: serialNumber,
                    productId: productId,
                    batchNumber: batchNumber,
                    expiryDate: expiryDate,
                    locationId: targetLocation,
                    status: condition === 'SEALED' ? PackStatus.SEALED : PackStatus.OPENED,
                    unitsPerPack: productDef.unitsPerPack || 1,
                    remainingUnits: quantity,
                    createdAt: new Date(), // Fixed: Expects Date object, not string
                    history: [{
                        date: new Date().toISOString(),
                        action: 'RETURN_CREATED',
                        userId: 'SYSTEM',
                        details: 'Created from return'
                    }],
                    sourceDeliveryNoteId: 'RETURN' // Mandatory field
                };
                // Ensure ID uniqueness if using serialNumber as ID
                if (this.serializedPacks.some(p => p.id === newPack.id)) {
                    newPack.id = `PACK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                }
                this.serializedPacks.push(newPack);
            }
        }

        // 3. Update Aggregate Inventory
        if (existingInv) {
            existingInv.theoreticalQty += quantity;
            existingInv.lastUpdated = new Date();
        } else {
            this.inventory.push({
                id: `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                productId: productId,
                name: productDef.name,
                category: productDef.type === ProductType.DRUG ? ItemCategory.ANTIBIOTICS : ItemCategory.CONSUMABLES,
                location: targetLocation,
                batchNumber: batchNumber,
                expiryDate: expiryDate,
                unitPrice: (productDef.suppliers[0]?.purchasePrice || 0) / (productDef.unitsPerPack || 1),
                theoreticalQty: quantity,
                actualQty: null,
                lastUpdated: new Date()
            });
        }

        this.saveData();
    }

    public markDispensationAsReturned(dispensationId: string, quantity: number) {
        const dispensation = this.dispensations.find(d => d.id === dispensationId);
        if (dispensation) {
            dispensation.returnedQuantity = (dispensation.returnedQuantity || 0) + quantity;

            // Calculate total units dispensed to compare correctly
            let totalUnitsDispensed = dispensation.quantity;

            // Check if mode is BOX/FULL_PACK -> Convert to units
            if ((dispensation.mode as any) === 'FULL_PACK' || (dispensation.mode as any) === 'Boîte Complète' || (dispensation.mode as any) === 'BOX') {
                const product = this.catalog.find(p => p.id === dispensation.productId);
                if (product && product.unitsPerPack > 1) {
                    totalUnitsDispensed = dispensation.quantity * product.unitsPerPack;
                }
            }

            // If fully returned (returned UNITS >= dispensed UNITS), mark as RETURNED status
            if (dispensation.returnedQuantity >= totalUnitsDispensed) {
                dispensation.status = 'RETURNED';
            } else {
                // Ensure status is NOT returned if it was previously set incorrectly
                // (or if we are doing partial returns)
                delete dispensation.status;
            }
            this.saveData();
        }
    }

    // Process Return to Service Stock
    public processServiceReturn(params: {
        productId: string,
        batchNumber: string,
        expiryDate: string,
        quantity: number,
        condition: string,
        locationId: string,
        serviceId?: string
    }) {
        const { productId, batchNumber, expiryDate, quantity, locationId, serviceId } = params;
        const productDef = this.getProductById(productId);
        if (!productDef) return;

        // Find existing inventory in this service location
        let existingInv = this.inventory.find(i =>
            i.productId === productId &&
            i.batchNumber === batchNumber &&
            i.location === locationId
        );

        if (existingInv) {
            existingInv.theoreticalQty += quantity;
            existingInv.lastUpdated = new Date();
        } else {
            // Create new inventory item for service stock
            this.inventory.push({
                id: `INV-SERV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                productId: productId,
                name: productDef.name,
                category: productDef.type === ProductType.DRUG ? ItemCategory.ANTIBIOTICS : ItemCategory.CONSUMABLES,
                location: locationId,
                serviceId: serviceId, // Important for scoping
                batchNumber: batchNumber,
                expiryDate: expiryDate,
                unitPrice: (productDef.suppliers[0]?.purchasePrice || 0) / (productDef.unitsPerPack || 1),
                theoreticalQty: quantity,
                actualQty: null,
                lastUpdated: new Date()
            });
        }
        this.saveData();
    }

    // FEFO Dispensation Logic
    // FEFO Dispensation Logic
    async dispenseWithFEFO(params: {
        productId: string,
        quantity: number,
        mode: string, // 'UNIT' | 'FULL_PACK'
        userId: string,
        prescriptionId: string,
        admissionId?: string,
        targetPackIds?: string[]
    }): Promise<Dispensation[]> {
        const { admissionId, quantity } = params;
        if (!admissionId) throw new Error("Admission ID is required for dispensation.");
        if (quantity <= 0) throw new Error("La quantité doit être positive.");

        const productDef = this.getProductById(params.productId);
        if (!productDef) throw new Error("Produit inconnu");

        // Delegate to DispensationService (which handles Strict Transfer now)
        const dispensations = await dispensationService.dispense({
            ...params,
            admissionId: admissionId!,
            mode: params.mode as any
        }, productDef);

        // Update Admission Logical Stock (InventoryItem)
        dispensations.forEach(d => {
             // 3. Create Consumptions in EMR (Sink)
             // We do NOT create stock in ADMISSION:xxx location anymore (User Requirement)
             
             const consumption: AdmissionMedicationConsumption = {
                  id: `cons-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  admissionId: d.admissionId,
                  productId: d.productId,
                  productName: d.productName || 'Médicament Inconnu',
                  quantity: d.quantity,
                  mode: (d.mode as any) === 'FULL_PACK' || d.mode === DispensationMode.FULL_PACK ? 'BOX' : 'UNIT',
                  lotNumber: d.lotNumber,
                  batchNumber: d.lotNumber,
                  dispensedAt: d.dispensedAt instanceof Date ? d.dispensedAt.toISOString() : d.dispensedAt,
                  dispensedBy: d.dispensedBy,
                  source: 'PHARMACY',
                  prescriptionId: d.prescriptionId
             };
             
             emrService.addMedicationConsumption(consumption);
        });
        
        // Critical: Persist the new dispensations to the PharmacyService state so they are saved to DB
        this.dispensations.push(...dispensations);

        this.saveData();
        return dispensations;
    }


    /**
     * Dispense directly from Service Stock (Sortie Pharmacie)
     */
    dispenseFromServiceStock(params: {
        admissionId: string;
        serviceId: string; // The service asking for output (e.g. "Cardiologie")
        items: {
            productId: string;
            quantity: number;
            mode: 'BOX' | 'UNIT';
            dispensedBatches?: { batchNumber: string; quantity: number }[]; // For Manual
        }[];
    }) {
        const { admissionId, serviceId, items } = params;
        const newDispensations: Dispensation[] = [];

        items.forEach(item => {
            const productDef = this.getProductById(item.productId);
            if (!productDef) return;

            // 1. Identify Source Stock (Service Location)
            // We look for InventoryItems belonging to this service
            // DEMO FIX: Relaxed to allow "Tous Services" visibility
            const serviceInventory = this.inventory.filter(i =>
                i.productId === item.productId &&
                (!!i.serviceId) && // Allow ANY service stock
                i.theoreticalQty > 0
            );

            const totalAvailable = serviceInventory.reduce((acc, i) => acc + i.theoreticalQty, 0);

            // Determine Qty in Units for validation (if mode is Box, we assume Inventory is stored in Units/Boxes? 
            // InventoryItem.theoreticalQty is usually in Units or Boxes depending on convention. 
            // In ReplenishmentProcessing, we store quantity. 
            // Generally InventoryItem tracks units (e.g. tablet count or box count?)
            // Let's assume theoreticalQty is in "Basic Unit" (Boxes for drugs?).
            // If Replenishment adds "quantityApproved" which was Boxes...
            // Wait, ReplenishmentProcessing uses "quantityApproved" which we fixed to be Units if product is big?
            // "finalQuantity = state.quantity * activeProductDef.unitsPerPack;"
            // So InventoryItem tracks UNITS (e.g. pills).

            // So if `item.mode` is BOX, we need to convert to units for inventory deduction.
            const unitsPerPerPack = productDef.unitsPerPack || 1;
            const quantityToDeduct = item.mode === 'BOX' ? item.quantity * unitsPerPerPack : item.quantity;

            if (totalAvailable < quantityToDeduct) {
                console.warn(`[DispenseService] Not enough stock for ${productDef.name} in ${serviceId}. Wanted ${quantityToDeduct}, Has ${totalAvailable}`);
                // Proceed with what we have? Or throw?
                // Throwing might block the whole transaction. Let's allow partial or throw.
                throw new Error(`Stock insuffisant pour ${productDef.name} dans le service ${serviceId}`);
            }

            // 2. Allocation Logic
            let remainingToDeduct = quantityToDeduct;
            const allocatedBatches: { batchNumber: string; expiryDate: string; location: string; quantity: number }[] = [];

            // If Manual Batches provided
            if (item.dispensedBatches && item.dispensedBatches.length > 0) {
                item.dispensedBatches.forEach(b => {
                    // Find corresponding inventory item
                    const invItem = serviceInventory.find(i => i.batchNumber === b.batchNumber);
                    if (invItem && remainingToDeduct > 0) {
                        const take = Math.min(b.quantity, remainingToDeduct); // Batch quantity is likely in basic units? Or boxes?
                        // In modal, manual input max is theoreticalQty.
                        // So b.quantity is in Inventory Units.
                        allocatedBatches.push({
                            batchNumber: b.batchNumber,
                            expiryDate: invItem.expiryDate,
                            location: invItem.location,
                            quantity: b.quantity
                        });
                        remainingToDeduct -= b.quantity;
                    }
                });
            } else {
                // Auto FEFO on Service Stock
                // Sort by Expiry
                serviceInventory.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

                for (const invItem of serviceInventory) {
                    if (remainingToDeduct <= 0) break;
                    const take = Math.min(invItem.theoreticalQty, remainingToDeduct);
                    allocatedBatches.push({
                        batchNumber: invItem.batchNumber,
                        expiryDate: invItem.expiryDate,
                        location: invItem.location,
                        quantity: take
                    });
                    remainingToDeduct -= take;
                }
            }

            // 3. Apply Deduction & Create Records
            allocatedBatches.forEach(batch => {
                // Decrement Inventory
                const invItem = this.inventory.find(i =>
                    i.productId === item.productId &&
                    i.batchNumber === batch.batchNumber &&
                    i.location === batch.location
                );
                if (invItem) {
                    invItem.theoreticalQty -= batch.quantity;
                    if (invItem.theoreticalQty < 0) invItem.theoreticalQty = 0;
                }

                // Update Serialized Packs (Status -> DISPENSED)
                // We need to find packs in this location/batch
                // "Consume" them.
                serializedPackService.dispensePacks({
                    productId: item.productId,
                    batchNumber: batch.batchNumber,
                    locationId: batch.location,
                    mode: item.mode,
                    quantity: batch.quantity, // If BOX mode, this is Box count. If UNIT mode, it's Unit count.
                    unitsPerPack: unitsPerPerPack,
                    userId: 'Infirmier Service', // Should pass real user
                    reason: 'Sortie Pharmacie Service'
                });

                // 4. Create Dispensation Record (for traceability in Admission)
                // We define price.
                const pricePerUnit = (productDef.suppliers[0]?.purchasePrice || 0) / unitsPerPerPack;
                const cost = pricePerUnit * batch.quantity;

                // If mode was BOX, we display BOX count in dispensation?
                // Dispensation struct has 'quantity' and 'mode'.
                // If we split across batches, we might create multiple dispensations.

                // Let's assume we create one dispensation per batch for traceability.
                // Dispensation Quantity: usage in Admission.
                // If we consumed 10 units (1 box), we want to show "1 Box".
                // But here we might have 5 units from batch A and 5 from batch B.
                // We'll record them as Units to be safe/precise.

                const disp: Dispensation = {
                    id: `DISP-SERV-${Date.now()}-${Math.random()}`,
                    prescriptionId: 'SERVICE_EXIT', // Marker
                    admissionId: admissionId,
                    productId: item.productId,
                    productName: productDef.name,
                    mode: 'UNIT' as any, // Always record as UNIT splits if complex
                    quantity: batch.quantity,
                    serializedPackId: 'unknown', // We didn't strictly pick a pack ID here yet without fetch
                    lotNumber: batch.batchNumber,
                    expiryDate: batch.expiryDate,
                    serialNumber: 'BATCH-EXIT',
                    unitPriceExclVAT: pricePerUnit,
                    vatRate: productDef.vatRate,
                    totalPriceInclVAT: cost * (1 + productDef.vatRate / 100),
                    dispensedAt: new Date(),
                    dispensedBy: 'Infirmier Service' // TODO user
                };

                // Friendly display fix: If original request was BOX and we fully satisfied with one batch of proper size
                if (item.mode === 'BOX' && batch.quantity % unitsPerPerPack === 0) {
                    disp.mode = 'FULL_PACK' as any;
                    disp.quantity = batch.quantity / unitsPerPerPack;
                }

                newDispensations.push(disp);
                this.dispensations.push(disp);
            });
        });

        this.saveData();
        return newDispensations;
    }

    getDispensationsByPrescription(prescriptionId: string): Dispensation[] {
        return this.dispensations
            .filter(d => d.prescriptionId === prescriptionId)
            .map(d => {
                const product = this.catalog.find(p => p.id === d.productId);
                return {
                    ...d,
                    productName: d.productName || product?.name || 'Médicament Inconnu'
                };
            });
    }

    getDispensationsByAdmission(admissionId: string): Dispensation[] {
        return this.dispensations
            .filter(d => d.admissionId === admissionId)
            .map(d => {
                const product = this.catalog.find(p => p.id === d.productId);
                return {
                    ...d,
                    productName: d.productName || product?.name || 'Médicament Inconnu'
                };
            });
    }

    // Serialized Pack Getters
    getSerializedPacks(filters?: { tenantId?: string, productId?: string, locationId?: string, status?: PackStatus }): SerializedPack[] {
        let packs = serializedPackService.getAllPacks(); // Get from SSOT (Service)
        
        if (filters?.tenantId) {
            packs = packs.filter(p => !p.tenantId || p.tenantId === filters.tenantId);
        }

        if (filters?.productId) {
            packs = packs.filter(p => p.productId === filters.productId);
        }

        if (filters?.status) {
            packs = packs.filter(p => p.status === filters.status);
        }

        if (filters?.locationId) {
            packs = packs.filter(p => p.locationId === filters.locationId);
        }
        
        return packs;
    }

    getSerializedPackById(id: string): SerializedPack | null {
        return this.serializedPacks.find(p => p.id === id) || null;
    }

    // Replenishment & Service Stock Logic

    getReplenishmentRequests(tenantId?: string): ReplenishmentRequest[] {
        let items = this.replenishmentRequests;
        if (tenantId) {
            items = items.filter(r => !r.tenantId || r.tenantId === tenantId);
        }
        return items;
    }

    createReplenishmentRequest(request: Partial<ReplenishmentRequest>): ReplenishmentRequest {
        const newRequest: ReplenishmentRequest = {
            id: `REP-${Date.now()}`,
            requesterId: request.requesterId || 'unknown',
            requesterName: request.requesterName || 'Infirmier',
            serviceName: request.serviceName || 'Service',
            status: ReplenishmentStatus.PENDING,
            items: (request.items || []).map((item: any) => ({
                ...item,
                quantityRequested: item.quantity || item.quantityRequested, 
                quantityApproved: 0
            })),
            createdAt: new Date(),
            updatedAt: new Date(),
            tenantId: request.tenantId, // Store Tenant ID
            ...request
        } as ReplenishmentRequest;

        this.replenishmentRequests.push(newRequest);
        this.saveData();
        return newRequest;
    }

    updateReplenishmentRequest(id: string, updates: Partial<ReplenishmentRequest>): ReplenishmentRequest {
        const index = this.replenishmentRequests.findIndex(r => r.id === id);
        if (index === -1) throw new Error("Request not found");

        this.replenishmentRequests[index] = {
            ...this.replenishmentRequests[index],
            ...updates,
            updatedAt: new Date()
        };
        this.saveData();
        return this.replenishmentRequests[index];
    }

    // This handles the status change AND the stock movement if validating
    // NOW SUPPORTS INCREMENTAL DISPENSATION (Delta updates)
    updateReplenishmentRequestStatus(id: string, status: ReplenishmentStatus, processedRequestDelta?: ReplenishmentRequest) {
        const index = this.replenishmentRequests.findIndex(r => r.id === id);
        if (index === -1) throw new Error("Request not found");

        const request = this.replenishmentRequests[index];

        // Process Stock Movement for the DELTA (newly dispensed items only)
        if (processedRequestDelta) {
            // 1. Execute Stock Transfer for the new batches immediately
            this.processStockTransferForItems(processedRequestDelta.items, request.serviceName);

            // 2. Merge history into the persistent request
            processedRequestDelta.items.forEach(deltaItem => {
                const targetItem = request.items.find(i => i.productId === deltaItem.productId);
                if (targetItem) {
                    // Update stats
                    targetItem.quantityApproved = (targetItem.quantityApproved || 0) + (deltaItem.quantityApproved || 0);
                    targetItem.productDispensedId = deltaItem.productDispensedId; // Update substitution info if changed (or keep latest)
                    targetItem.productDispensedName = deltaItem.productDispensedName;

                    // Append batches
                    const newBatches = deltaItem.dispensedBatches || [];
                    targetItem.dispensedBatches = [...(targetItem.dispensedBatches || []), ...newBatches];
                }
            });
        }

        // Update general status
        request.status = status;
        request.updatedAt = new Date();
        this.saveData();
        return request;
    }

    private processStockTransferForItems(items: any[], serviceName: string) {
        // Move stock from Pharmacy (Main) to Service Stock
        items.forEach(item => {
            if (!item.quantityApproved && (!item.dispensedBatches || item.dispensedBatches.length === 0)) return;

            const productId = item.productDispensedId || item.productId; // Use substituted product if present
            let batches = item.dispensedBatches || [];

            // AUTO-ALLOCATION: If no batches selected manually but quantity approved > 0, use FEFO 
            if (batches.length === 0 && item.quantityApproved > 0) {
                // Find pharmacy stock (items without serviceId)
                const availableStock = this.inventory
                    .filter(i => i.productId === productId && !i.serviceId && i.theoreticalQty > 0)
                    .sort((a, b) => {
                        // FEFO: First Expired First Out
                        const dateA = new Date(a.expiryDate).getTime();
                        const dateB = new Date(b.expiryDate).getTime();
                        if (dateA !== dateB) return dateA - dateB;
                        // Tier break: prioritize opened packs
                        return a.theoreticalQty - b.theoreticalQty;
                    });

                let remainingQty = item.quantityApproved;

                for (const stockItem of availableStock) {
                    if (remainingQty <= 0) break;

                    const takeQty = Math.min(stockItem.theoreticalQty, remainingQty);
                    batches.push({
                        batchNumber: stockItem.batchNumber,
                        quantity: takeQty,
                        expiryDate: stockItem.expiryDate
                    } as any);

                    remainingQty -= takeQty;
                }

                // Important: Update the DELTA item's batches so they get merged correctly into history later
                item.dispensedBatches = batches;

                // CRITICAL FIX: If allocation yielded 0 items (e.g. no stock found), we MUST set quantityApproved to 0 (or actual allocated total)
                // Otherwise we create "phantom stock" in history (Approved > 0 but no batches moved).
                const allocatedTotal = batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
                if (allocatedTotal < item.quantityApproved) {
                    console.warn(`[StockTransfer] Requested ${item.quantityApproved} but could only allocate ${allocatedTotal}. Adjusting approval.`);
                    item.quantityApproved = allocatedTotal;
                }
            }

            // Defaults
            const targetLocation = item.targetLocationId || 'LOC-RESERVE'; // Default to a reserve location if none specified
            const serviceId = serviceName || 'SERVICE_DEFAULT';

            batches.forEach((batch: any) => {
                const batchExpiry = batch.expiryDate || this.getBatchExpiry(productId, batch.batchNumber);

                // 1. Decrement Pharmacy Stock
                this.decrementPharmacyStock(productId, batch.batchNumber, batch.quantity);

                // 2. Increment Service Stock
                this.incrementServiceStock(serviceId, productId, batch.batchNumber, batch.quantity, batchExpiry, targetLocation);

                // 3. TRANSFER SERIALIZED PACKS
                // If the product is tracked by serialization, we must move the packs to the service location
                // The targetLocation passed here is usually specific (e.g. 'Armoire Urgence'), or a generic service ID.
                // We should use the serviceId as the new "location status" or the actual targetLocationId if it acts as a container.
                const newLocationId = targetLocation;

                serializedPackService.transferPacks({
                    productId: productId,
                    batchNumber: batch.batchNumber,
                    quantity: batch.quantity,
                    toLocationId: newLocationId,
                    reason: `Replenishment for ${serviceName}`,
                    userId: 'system' // TODO: Pass actual user ID
                });
            });
        });
    }

    // Deprecated wrapper to maintain compatibility if called internally elsewhere, though we now use processStockTransferForItems
    private processReplenishmentStockTransfer(request: ReplenishmentRequest) {
        this.processStockTransferForItems(request.items, request.serviceName);
    }

    private getBatchExpiry(productId: string, batchNumber: string): string {
        const item = this.inventory.find(i => i.productId === productId && i.batchNumber === batchNumber && !i.serviceId);
        return item ? item.expiryDate : new Date().toISOString(); // Fallback
    }

    private decrementPharmacyStock(productId: string, batchNumber: string, quantity: number) {
        // Find main inventory item (serviceId undefined or null)
        const item = this.inventory.find(i =>
            i.productId === productId &&
            i.batchNumber === batchNumber &&
            !i.serviceId // Ensure we strictly target Pharmacy Stock
        );

        if (item) {
            item.theoreticalQty -= quantity;
            if (item.theoreticalQty < 0) item.theoreticalQty = 0;
            item.lastUpdated = new Date();
        } else {
            // Fallback: try to find any item for this product/batch if strictly main stock not found?
            // Or maybe it's managed via Serialized Packs?
            // For now we assume hybrid model where InventoryItem tracks numbers.
            // If Serialized Packs are used, they should also be updated (status = DISPENSED or TRANSFERED?)
            // The prompt mentions "Status: Dispensée".
            // If we have Serialized Packs matching this batch, we should mark them as DISPENSED.
            this.dispenseSerializedPacksByBatch(productId, batchNumber, quantity);
        }
    }

    private dispenseSerializedPacksByBatch(productId: string, batchNumber: string, quantity: number) {
        // Find available packs
        const packs = this.serializedPacks.filter(p =>
            p.productId === productId &&
            p.batchNumber === batchNumber &&
            (p.status === PackStatus.SEALED || p.status === PackStatus.OPENED)
        );

        // Simple FIFO for packs status update if specific pack IDs not provided
        let remaining = quantity; // Quantity is usually in units? Or boxes?
        // ASSUMPTION: Replenishment quantity is in BOXES if product is packed, or UNITS?
        // Pharmacy usually manages Boxes.
        // Let's assume quantity is "Units" for calculation safety, but usually it matches Pack Units.
        // If product.unitsPerPack > 1, and quantity is in units.

        // We need product definition to know units.
        const product = this.getProductById(productId);
        const unitsPerPack = product?.unitsPerPack || 1;

        // If quantity is small (e.g. 5 boxes), we expect 5 * unitsPerPack units.
        // But here `quantity` comes from `dispensedBatches.quantity`.
        // The UI usually handles Boxes. If the user input 5 boxes.
        // We should treat `quantity` as Boxes for Packs? Or Units?
        // In `decrementPharmacyStock`, we subtracted `quantity`.
        // If `theoreticalQty` is in UNITS (which it seems to be in `processQuarantine`: `totalUnits = batch.quantity * unitsPerPack`),
        // then `quantity` passed here MUST be in UNITS.
        // However, the helper might need adjustment based on UI.

        // For now, let's assume `quantity` is UNITS.
        // We update packs.

        // Use a loop
        for (const pack of packs) {
            if (remaining <= 0) break;

            const currentPackQty = pack.remainingUnits || unitsPerPack;

            if (currentPackQty <= remaining) {
                // Full pack consumed or transferred
                pack.status = PackStatus.DISPENSED; // or TRANSFERED?
                // pack.locationId should eventually reflect Service Location? 
                // But Service Stock is separate InventoryItem. 
                // If we want detailed tracking in Service, we should move the Pack record?
                // The prompt says "Stock Service" mirrors "Stock System".
                // So Service should have its OWN InventoryItems.
                // SerializedPack usually stays in Pharmacy DB but marked as dispensed to service?
                // Or we update locationId to EMR location?
                // "No stock changes until transfer validation".
                // Let's Mark as DISPENSED for now to remove from Pharmacy Main Stock.
                // Service Stock will be aggregate InventoryItems.

                remaining -= currentPackQty;
            } else {
                // Partial pack
                pack.remainingUnits = currentPackQty - remaining;
                pack.status = PackStatus.OPENED;
                remaining = 0;
            }
        }
    }

    private incrementServiceStock(serviceId: string, productId: string, batchNumber: string, quantity: number, expiryDate: string, locationId: string) {
        const product = this.getProductById(productId);
        const name = product?.name || 'Unknown Product';
        const category = product?.type === ProductType.DRUG ? ItemCategory.ANTIBIOTICS : ItemCategory.CONSUMABLES; 
        const unitPrice = (product?.suppliers?.[0]?.purchasePrice || 0) / (product?.unitsPerPack || 1);

        // Resolve Location Name if ID is provided
        const locationObj = this.locations.find(l => l.id === locationId);
        const locationName = locationObj ? locationObj.name : locationId;

        const existing = this.inventory.find(i =>
            i.serviceId === serviceId &&
            i.productId === productId &&
            i.batchNumber === batchNumber &&
            i.location === locationName 
        );

        if (existing) {
            existing.theoreticalQty += quantity;
            existing.lastUpdated = new Date();
        } else {
            this.inventory.push({
                id: `INV-SERV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                serviceId,
                productId,
                name,
                category,
                location: locationName, 
                batchNumber,
                expiryDate,
                unitPrice,
                theoreticalQty: quantity,
                actualQty: null,
                lastUpdated: new Date()
            } as InventoryItem);
        }
    }

    // --- Product Versioning Logic ---

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    public getProductVersions(productId: string): ProductVersion[] {
        return this.productVersions.filter(v => v.productId === productId).sort((a, b) => b.versionNumber - a.versionNumber);
    }

    public getActiveProductVersion(productId: string): ProductVersion | undefined {
        // Find version where validTo is undefined (active)
        let active = this.productVersions.find(v => v.productId === productId && !v.validTo);

        // Fallback: if no active version found (legacy data), create active version based on current Product Definition
        if (!active) {
            const product = this.getProductById(productId);
            if (product) {
                const newVersion: ProductVersion = {
                    id: this.generateId(),
                    productId: product.id,
                    versionNumber: 1,
                    isSubdivisable: product.isSubdivisable,
                    unitsPerPack: product.unitsPerPack,
                    validFrom: new Date(),
                    createdAt: new Date(),
                    createdBy: 'SYSTEM_MIGRATION'
                };
                this.productVersions.push(newVersion);
                this.saveData(); 
                return newVersion;
            }
        }
        return active;
    }

    public updateProductSubdivisibility(productId: string, isSubdivisable: boolean, userId: string): ProductDefinition {
        const product = this.getProductById(productId);
        if (!product) throw new Error('Product not found');

        if (product.isSubdivisable === isSubdivisable) return product; // No change

        // 1. Close current version
        const currentVersion = this.getActiveProductVersion(productId);
        if (currentVersion) {
            currentVersion.validTo = new Date();
        }

        // 2. Create new version
        const newVersionNumber = (currentVersion?.versionNumber || 0) + 1;
        const newVersion: ProductVersion = {
            id: this.generateId(),
            productId: product.id,
            versionNumber: newVersionNumber,
            isSubdivisable: isSubdivisable, // New status
            unitsPerPack: product.unitsPerPack, // Carry over 
            validFrom: new Date(),
            createdAt: new Date(),
            createdBy: userId
        };
        this.productVersions.push(newVersion);

        // 3. Update main product definition (snapshot of current state)
        product.isSubdivisable = isSubdivisable;
        product.updatedAt = new Date();

        this.updateProduct(product); 
        this.saveData(); 

        return product;
    }

    public dispenseItem(params: {
        requestId: string,
        itemProductId: string,
        dispensedProductId: string,
        quantity: number,
        batches: { batchNumber: string, quantity: number, expiryDate: string }[],
        targetLocationId?: string,
        unitType?: 'BOX' | 'UNIT'
    }) {
        const { requestId, itemProductId, dispensedProductId, quantity, batches, targetLocationId, unitType } = params;

        // 1. Fetch Request
        const request = this.replenishmentRequests.find(r => r.id === requestId);
        if (!request) throw new Error("Request not found");

        const requestItem = request.items.find(i => i.productId === itemProductId);
        if (!requestItem) throw new Error("Item not found in request");

        // 2. Process Stock Movement (Atomic per batch)
        // Resolve Service ID (Handle snake_case fallback from legacy requests)
        const targetServiceId = request.serviceId || (request as any).service_id;

        batches.forEach(batch => {
            // A. Decrement Pharmacy Stock
            // Find BEST matching inventory line
            let sourceItem = this.inventory.find(i => 
                i.productId === dispensedProductId && 
                i.batchNumber === batch.batchNumber && 
                (!i.serviceId || i.serviceId === null) &&
                i.theoreticalQty >= batch.quantity
            );
            
            if (!sourceItem) {
                 // Try find ANY line even if distinct location
                 sourceItem = this.inventory.find(i => 
                    i.productId === dispensedProductId && 
                    i.batchNumber === batch.batchNumber && 
                    (!i.serviceId)
                );
            }

            if (sourceItem) {
                sourceItem.theoreticalQty -= batch.quantity;
                sourceItem.lastUpdated = new Date();
            } else {
                 console.warn(`[PharmacyService] Stock source mismatch for batch ${batch.batchNumber}. Decrementing anyway if found, otherwise skipping strict check for dev.`);
            }

            // B. Increment Service Stock
            // Target Location: Either from Request Item or Default Service Location
            const finalLocationId = targetLocationId || requestItem.targetLocationId;
            // console.log(`[DEBUG] Target Location Resolution: Param=${targetLocationId}, Item=${requestItem.targetLocationId} -> FINAL=${finalLocationId}`);
            
            // Find or Create Service Inventory Line
            const existingServiceItem = this.inventory.find(i => 
                i.productId === dispensedProductId &&
                i.batchNumber === batch.batchNumber &&
                i.location === finalLocationId &&
                i.serviceId === targetServiceId
            );

            if (existingServiceItem) {
                existingServiceItem.theoreticalQty += batch.quantity;
                existingServiceItem.lastUpdated = new Date();
            } else {
                // Get product details for metadata
                const productDef = this.catalog.find(p => p.id === dispensedProductId);
                
                // Map ProductType to ItemCategory
                let category = ItemCategory.CONSUMABLES;
                if (productDef?.type === ProductType.DRUG) {
                    category = ItemCategory.ANTIBIOTICS; // Default fallback
                }

                // Helper to generate ID within class context if needed, or just manual
                const id = `INV-SERV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                if (!targetServiceId) {
                    console.error("CRITICAL: Dispensing to Service but no targetServiceId resolved!");
                    // throw new Error("Service ID missing"); // Soft fail for now but log
                }
                
                this.inventory.push({
                    id: id,
                    productId: dispensedProductId,
                    name: productDef?.name || 'Unknown',
                    category: category,
                    location: finalLocationId || targetServiceId || 'UNKNOWN_SVC_LOC', // Fallback to Service ID
                    batchNumber: batch.batchNumber,
                    serviceId: targetServiceId, // Ensure Service ID is set!
                    expiryDate: batch.expiryDate,
                    theoreticalQty: batch.quantity,
                    actualQty: null,
                    // serviceId already set above
                    tenantId: request.tenantId,   // Scoped to Tenant
                    lastUpdated: new Date(),
                    unitPrice: sourceItem?.unitPrice || 0
                });
            }

            // C. Transfer Serialized Packs (CRITICAL FOR BOX DISPLAY)
            // Strict enforcement of dispensed_as mode
            if (unitType === 'BOX') {
                const productDef = this.catalog.find(p => p.id === dispensedProductId);
                const unitsPerPack = productDef?.unitsPerPack || 1;
                const packsToTransfer = Math.floor(batch.quantity / unitsPerPack);
                
                if (packsToTransfer > 0) {
                    serializedPackService.transferPacks({
                        productId: dispensedProductId.trim(),
                        batchNumber: batch.batchNumber.trim(),
                        quantity: packsToTransfer,
                        toLocationId: finalLocationId || targetServiceId, // Guaranteed non-null from previous fix
                        reason: `Replenishment for ${request.serviceName}`,
                        userId: request.requesterId
                    });
                }
            } else {
                // console.log(`[DEBUG] Unit Mode - Skipping Pack Transfer`);
                // If UNIT mode, we do NOT transfer sealed packs. 
                // We only transfer loose units (handled by InventoryItem update above).
                // Sealed boxes must remain sealed in Pharmacy or be opened (status change) but NOT transferred as sealed.
            }
        });

        // 3. Update Request State
        if (!requestItem.dispensedBatches) requestItem.dispensedBatches = [];
        
        // Resolve dispensed product name
        const dispensedProductDef = this.catalog.find(p => p.id === dispensedProductId);
        const dispensedProductName = dispensedProductDef?.name || 'Unknown Product';

        batches.forEach(b => {
            requestItem.dispensedBatches?.push({
                batchNumber: b.batchNumber,
                quantity: b.quantity,
                expiryDate: b.expiryDate,
                productId: dispensedProductId,
                productName: dispensedProductName,
                dispensedAs: unitType || 'BOX' // Persist mode
            });
        });

        // Update Approved/Dispensed Quantity (Accumulative)
        requestItem.quantityApproved = (requestItem.quantityApproved || 0) + quantity;
        
        // If substitution - Update Item Level "Most Recent" Substitution for convenience, 
        // BUT individual batches now hold truth.
        if (dispensedProductId !== itemProductId) {
             requestItem.productDispensedId = dispensedProductId;
             requestItem.productDispensedName = dispensedProductName;
        }

       this.saveData();
       
       return { 
           success: true, 
           requestItem, 
           updatedInventory: this.getInventory(request.tenantId) 
       };
    }


}

export const pharmacyService = new PharmacyService();
// Force restart Mon Jan  5 05:04:41 +01 2026
