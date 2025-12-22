
import {
    InventoryItem, ItemCategory, ProductDefinition, ProductType, StockLocation,
    PartnerInstitution, StockOutTransaction, StockOutType, DestructionReason,
    PurchaseOrder, DeliveryNote, QuarantineSessionResult, PharmacySupplier,
    ReplenishmentRequest, ReplenishmentStatus
} from '../models/pharmacy';
import { SerializedPack, PackStatus, Dispensation } from '../models/serialized-pack';
import { serializedPackService } from './serializedPackService';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'pharmacy_db.json');

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
    private purchaseOrders: PurchaseOrder[] = [];
    private deliveryNotes: DeliveryNote[] = [];
    private serializedPacks: SerializedPack[] = [];
    private dispensations: Dispensation[] = [];
    private suppliers: PharmacySupplier[] = [];
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
                serializedPacks: this.serializedPacks,
                dispensations: this.dispensations,
                suppliers: this.suppliers,
                replenishmentRequests: this.replenishmentRequests
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
                this.catalog = data.catalog || [];
                this.locations = data.locations || [];
                this.partners = data.partners || [];
                this.stockOutHistory = data.stockOutHistory || [];
                this.purchaseOrders = data.purchaseOrders || [];
                this.deliveryNotes = data.deliveryNotes || [];
                this.deliveryNotes = data.deliveryNotes || [];
                this.serializedPacks = data.serializedPacks || [];
                // Load Replenishment Requests with Date conversion
                this.replenishmentRequests = (data.replenishmentRequests || []).map((r: any) => ({
                    ...r,
                    createdAt: new Date(r.createdAt),
                    updatedAt: new Date(r.updatedAt)
                }));

                this.dispensations = (data.dispensations || []).map((d: any) => ({
                    ...d,
                    dispensedAt: new Date(d.dispensedAt)
                }));

                this.suppliers = (data.suppliers || []).map((s: any) => ({
                    ...s,
                    createdAt: new Date(s.createdAt),
                    updatedAt: new Date(s.updatedAt)
                }));
            }
        } catch (error) {
            console.error("Error loading pharmacy data:", error);
        }
    }

    // Getters and Setters
    getInventory(): InventoryItem[] {
        return this.inventory;
    }

    getCatalog(): ProductDefinition[] {
        // Calculate live stock from serialized packs
        return this.catalog.map(product => {
            const activePacks = this.serializedPacks.filter(p =>
                p.productId === product.id &&
                (p.status === PackStatus.SEALED || p.status === PackStatus.OPENED)
            );

            // Calculate total units available (packs * unitsPerPack + partial units)
            // But usually currentStock implies "boxes" or "total units"? 
            // The frontend displays "qty disponible" which usually means boxes in BOX mode.
            // However, usually detailed stock (units) is better.
            // Let's stick to the simplest interpretation: quantity of packs + partials converted?
            // Actually, for the search preview, we just need to know if > 0.
            // Let's sum up remaining units.

            const totalUnits = activePacks.reduce((sum, pack) => sum + (pack.remainingUnits || pack.unitsPerPack), 0);

            // We can also calculate full boxes
            const fullBoxes = activePacks.filter(p => p.status === PackStatus.SEALED).length;

            return {
                ...product,
                currentStock: fullBoxes // Or totalUnits? The frontend often treats currentStock as a generic number. 
                // Let's check how 'currentStock' is defined. In ProductDefinition it is a number.
                // If I return 0 when no packs, that's enough to disable it.
                // Let's return total active packs count as a safe proxy for "available stock" for now, 
                // or better, if the frontend assumes currentStock is just for display/availability check.
                // Given the requirement is "0 units and 0 boxes", if totalUnits is 0, currentStock should be 0.
                // Let's set currentStock to totalUnits to be precise, as partial packs count as stock.
                // Wait, if I have 1 opened pack with 1 tablet, is it in stock? Yes.
            };
        });
    }

    addProduct(product: ProductDefinition) {
        this.catalog.push(product);
        this.saveData();
        return product;
    }

    updateProduct(product: ProductDefinition): ProductDefinition {
        const index = this.catalog.findIndex(p => p.id === product.id);
        if (index !== -1) {
            this.catalog[index] = { ...product, updatedAt: new Date() };
            this.saveData();
            return this.catalog[index];
        }
        throw new Error(`Product with ID ${product.id} not found.`);
    }

    addLocation(location: StockLocation) {
        if (!location.id) {
            location.id = `LOC-${Date.now()}`;
        }
        this.locations.push(location);
        this.saveData();
        return location;
    }

    updateLocation(location: StockLocation): StockLocation {
        const index = this.locations.findIndex(l => l.id === location.id);
        if (index !== -1) {
            this.locations[index] = { ...location };
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

    getLocations(): StockLocation[] {
        return this.locations;
    }

    // Supplier Management
    getSuppliers(): PharmacySupplier[] {
        return this.suppliers;
    }

    addSupplier(supplier: PharmacySupplier) {
        if (!supplier.id) {
            supplier.id = `SUP-${Date.now()}`;
        }
        supplier.createdAt = new Date();
        supplier.updatedAt = new Date();
        this.suppliers.push(supplier);
        this.saveData();
        return supplier;
    }

    updateSupplier(supplier: PharmacySupplier): PharmacySupplier {
        const index = this.suppliers.findIndex(s => s.id === supplier.id);
        if (index !== -1) {
            this.suppliers[index] = { ...supplier, updatedAt: new Date() };
            this.saveData();
            return this.suppliers[index];
        }
        throw new Error(`Supplier with ID ${supplier.id} not found.`);
    }

    deleteSupplier(id: string): void {
        const initialLength = this.suppliers.length;
        this.suppliers = this.suppliers.filter(s => s.id !== id);
        if (this.suppliers.length === initialLength) {
            throw new Error(`Supplier with ID ${id} not found.`);
        }
        this.saveData();
    }

    getPartners(): PartnerInstitution[] {
        return this.partners;
    }

    // PO & Delivery Management
    createPurchaseOrder(po: PurchaseOrder) {
        this.purchaseOrders.push(po);
        this.saveData();
        return po;
    }

    getPurchaseOrders() {
        return this.purchaseOrders;
    }

    createDeliveryNote(note: DeliveryNote) {
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

    getDeliveryNotes() {
        return this.deliveryNotes;
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

                // Add new packs to main storage
                this.serializedPacks.push(...newPacks);

                // Update Aggregate Inventory (InventoryItem)
                const inventoryId = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                const totalUnits = batch.quantity * (product.unitsPerPack || 1);

                // Check if existing line for same batch/location/product
                const existingItem = this.inventory.find(i =>
                    i.productId === procItem.productId &&
                    i.batchNumber === batch.batchNumber &&
                    i.location === batch.locationId
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
                        lastUpdated: new Date()
                    });
                }
            });
        });

        this.saveData();
        return { success: true };
    }

    // FEFO Dispensation Logic
    dispenseWithFEFO(params: {
        productId: string,
        quantity: number,
        mode: string, // 'UNIT' | 'FULL_PACK'
        userId: string,
        prescriptionId: string,
        admissionId?: string,
        targetPackIds?: string[]
    }): Dispensation[] {
        const { productId, quantity, mode, userId, prescriptionId, admissionId, targetPackIds } = params;

        // 1. Find active packs for product
        let candidates = this.serializedPacks.filter(p =>
            p.productId === productId &&
            [PackStatus.SEALED, PackStatus.OPENED].includes(p.status)
        );

        // Manual Selection Logic
        if (targetPackIds && targetPackIds.length > 0) {
            candidates = candidates.filter(p => targetPackIds.includes(p.id));
            if (candidates.length < targetPackIds.length) {
                throw new Error("Certains packs sélectionnés ne sont plus disponibles.");
            }
        } else {
            // Auto FEFO Sort
            candidates.sort((a, b) => {
                if (a.status === PackStatus.OPENED && b.status !== PackStatus.OPENED) return -1;
                if (a.status !== PackStatus.OPENED && b.status === PackStatus.OPENED) return 1;
                return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            });
        }

        const newDispensations: Dispensation[] = [];
        const productDef = this.getProductById(productId);
        if (!productDef) throw new Error("Produit inconnu");

        const supplier = productDef.suppliers[0];
        const purchasePrice = supplier?.purchasePrice || 0;
        const priceWithMargin = purchasePrice * (1 + productDef.profitMargin / 100);
        const unitPriceExclVAT = priceWithMargin; // Prix unitaire (si par unité) ou par boîte? 
        // Logic: usually price is per pack in catalog? checkout unitsPerPack.
        // Assuming price in catalog is per PACK.
        const pricePerUnit = unitPriceExclVAT / (productDef.unitsPerPack || 1);

        if (mode === 'FULL_PACK') {
            if (candidates.length < quantity) {
                throw new Error(`Stock insuffisant. ${candidates.length} boîtes disponibles.`);
            }

            for (let i = 0; i < quantity; i++) {
                const pack = candidates[i];
                pack.status = PackStatus.DISPENSED;
                pack.history.push({
                    date: new Date().toISOString(),
                    action: 'DISPENSATION',
                    userId: userId,
                    details: `Dispensation Prescription ${prescriptionId}`
                });

                // Update Aggregate Inventory
                // Update Aggregate Inventory
                // Helper to normalize strings for comparison
                const normalize = (s: string) => s?.trim().toLowerCase() || '';

                let invItem = this.inventory.find(inv =>
                    inv.productId === productId &&
                    inv.batchNumber === pack.batchNumber &&
                    normalize(inv.location) === normalize(pack.locationId)
                );

                // Fallback: if not found by location, try finding by product+batch only (legacy support / mismatch fix)
                if (!invItem) {
                    const candidates = this.inventory.filter(inv =>
                        inv.productId === productId &&
                        inv.batchNumber === pack.batchNumber
                    );
                    if (candidates.length === 1) {
                        invItem = candidates[0];
                        console.warn(`Stock update: Location mismatch for pack ${pack.id}. Matched by batch only.`);
                    }
                }

                if (invItem) {
                    const unitsPerPack = productDef?.unitsPerPack || 1;
                    invItem.theoreticalQty -= unitsPerPack;
                    if (invItem.theoreticalQty < 0) invItem.theoreticalQty = 0;
                }

                // Create Dispensation Record
                const disp: Dispensation = {
                    id: `DISP-${Date.now()}-${i}`,
                    prescriptionId,
                    admissionId: admissionId || 'unknown',
                    productId,
                    productName: productDef.name,
                    mode: mode as any,
                    quantity: 1, // 1 Box
                    serializedPackId: pack.id,
                    lotNumber: pack.batchNumber,
                    expiryDate: pack.expiryDate,
                    serialNumber: pack.serialNumber,
                    unitPriceExclVAT: unitPriceExclVAT,
                    vatRate: productDef.vatRate,
                    totalPriceInclVAT: unitPriceExclVAT * (1 + productDef.vatRate / 100),
                    dispensedAt: new Date(),
                    dispensedBy: userId
                };
                newDispensations.push(disp);
            }
        } else {
            // UNIT MODE
            const totalUnits = candidates.reduce((acc, p) => acc + (p.remainingUnits || p.unitsPerPack), 0);
            if (totalUnits < quantity) throw new Error("Stock insuffisant.");

            let remaining = quantity;
            for (const pack of candidates) {
                if (remaining <= 0) break;

                const availableInPack = pack.remainingUnits || pack.unitsPerPack;
                const toTake = Math.min(availableInPack, remaining);

                pack.remainingUnits = (pack.remainingUnits || pack.unitsPerPack) - toTake;
                if (pack.status === PackStatus.SEALED) pack.status = PackStatus.OPENED;
                if (pack.remainingUnits === 0) pack.status = PackStatus.EMPTY;
                // Correction: EMPTY status overrides OPENED if 0 units
                if (pack.remainingUnits === 0) pack.status = PackStatus.EMPTY;

                pack.history.push({
                    date: new Date().toISOString(),
                    action: 'DISPENSATION_UNIT',
                    userId: userId,
                    details: `Dispensed ${toTake} units`
                });

                // Inventory
                // Inventory
                const normalize = (s: string) => s?.trim().toLowerCase() || '';

                let invItem = this.inventory.find(inv =>
                    inv.productId === productId &&
                    inv.batchNumber === pack.batchNumber &&
                    normalize(inv.location) === normalize(pack.locationId)
                );

                if (!invItem) {
                    const candidates = this.inventory.filter(inv =>
                        inv.productId === productId &&
                        inv.batchNumber === pack.batchNumber
                    );
                    if (candidates.length === 1) {
                        invItem = candidates[0];
                        console.warn(`Stock update (Unit): Location mismatch for pack ${pack.id}. Matched by batch only.`);
                    }
                }
                if (invItem) {
                    invItem.theoreticalQty -= toTake;
                    if (invItem.theoreticalQty < 0) invItem.theoreticalQty = 0;
                }

                const disp: Dispensation = {
                    id: `DISP-${Date.now()}-${pack.id}`,
                    prescriptionId,
                    admissionId: admissionId || 'unknown',
                    productId,
                    productName: productDef.name,
                    mode: mode as any,
                    quantity: toTake,
                    serializedPackId: pack.id,
                    lotNumber: pack.batchNumber,
                    expiryDate: pack.expiryDate,
                    serialNumber: pack.serialNumber,
                    unitPriceExclVAT: pricePerUnit,
                    vatRate: productDef.vatRate,
                    totalPriceInclVAT: (pricePerUnit * toTake) * (1 + productDef.vatRate / 100),
                    dispensedAt: new Date(),
                    dispensedBy: userId
                };
                newDispensations.push(disp);

                remaining -= toTake;
            }
        }

        this.dispensations.push(...newDispensations);
        this.saveData();
        return newDispensations;
    }

    getDispensationsByPrescription(prescriptionId: string): Dispensation[] {
        return this.dispensations.filter(d => d.prescriptionId === prescriptionId);
    }

    getDispensationsByAdmission(admissionId: string): Dispensation[] {
        return this.dispensations.filter(d => d.admissionId === admissionId);
    }

    // Serialized Pack Getters
    getSerializedPacks(filters?: {
        productId?: string;
        status?: PackStatus;
        locationId?: string;
        expiringBefore?: Date;
    }): SerializedPack[] {
        let result = [...this.serializedPacks];

        if (filters) {
            if (filters.productId) {
                result = result.filter(p => p.productId === filters.productId);
            }
            if (filters.status) {
                result = result.filter(p => p.status === filters.status);
            }
            if (filters.locationId) {
                result = result.filter(p => p.locationId === filters.locationId);
            }
            if (filters.expiringBefore) {
                result = result.filter(p =>
                    new Date(p.expiryDate) <= filters.expiringBefore!
                );
            }
        }

        return result;
    }

    getSerializedPackById(id: string): SerializedPack | null {
        return this.serializedPacks.find(p => p.id === id) || null;
    }

    // Replenishment & Service Stock Logic
    private replenishmentRequests: ReplenishmentRequest[] = [];

    getReplenishmentRequests(): ReplenishmentRequest[] {
        return this.replenishmentRequests;
    }

    createReplenishmentRequest(request: Partial<ReplenishmentRequest>): ReplenishmentRequest {
        const newRequest: ReplenishmentRequest = {
            id: `REP-${Date.now()}`,
            requesterId: request.requesterId || 'unknown',
            requesterName: request.requesterName || 'Infirmier',
            serviceName: request.serviceName || 'Service',
            status: ReplenishmentStatus.PENDING,
            items: request.items || [],
            createdAt: new Date(),
            updatedAt: new Date(),
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
        const category = product?.type === ProductType.DRUG ? ItemCategory.ANTIBIOTICS : ItemCategory.CONSUMABLES; // Simplified
        const unitPrice = (product?.suppliers[0]?.purchasePrice || 0) / (product?.unitsPerPack || 1);

        // Resolve Location Name if ID is provided
        const locationObj = this.locations.find(l => l.id === locationId);
        const locationName = locationObj ? locationObj.name : locationId;

        const existing = this.inventory.find(i =>
            i.serviceId === serviceId &&
            i.productId === productId &&
            i.batchNumber === batchNumber &&
            i.location === locationName // Match by Name
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
                location: locationId,
                batchNumber,
                expiryDate,
                unitPrice,
                theoreticalQty: quantity,
                actualQty: null,
                lastUpdated: new Date()
            });
        }
    }
}

export const pharmacyService = new PharmacyService();
