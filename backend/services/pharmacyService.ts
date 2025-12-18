
import {
    InventoryItem, ItemCategory, ProductDefinition, ProductType, StockLocation,
    PartnerInstitution, StockOutTransaction, StockOutType, DestructionReason
} from '../models/pharmacy';

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

    constructor() {
        this.initializeMockData();
    }

    private initializeMockData() {
        // Locations
        this.locations = MOCK_LOCATION_NAMES.map((name, index) => ({
            id: `LOC-${100 + index}`,
            name: name,
            description: `Unité de stockage standard ${index + 1}`,
            isActive: true
        }));

        // Partners
        this.partners = [
            {
                id: 'PART-001',
                name: 'Hôpital Général Central',
                type: 'Hôpital',
                contactPerson: 'Dr. Sarah Smith',
                phone: '01 45 67 89 00',
                email: 'pharmacie@hgc-paris.fr',
                address: '123 Rue de la Santé, Paris',
                isActive: true
            },
            {
                id: 'PART-002',
                name: 'Croix-Rouge Logistique',
                type: 'ONG',
                contactPerson: 'Marc Jones',
                phone: '01 22 33 44 55',
                email: 'logistique@croixrouge.fr',
                address: '45 Avenue de l\'Aide',
                isActive: true
            },
            {
                id: 'PART-003',
                name: 'Clinique de l\'Ouest',
                type: 'Clinique',
                contactPerson: 'Inf. Jackie',
                phone: '02 99 88 77 66',
                email: 'appros@cliniqueouest.com',
                address: '88 Blvd de l\'Ouest',
                isActive: true
            }
        ];

        // Catalog
        this.catalog = [
            {
                id: 'PROD-001',
                name: 'Amoxicilline 500mg Gélules',
                type: ProductType.DRUG,
                suppliers: [{ id: 'SUP-01', name: 'PharmaCorp Global', purchasePrice: 0.12, isActive: true }],
                profitMargin: 25,
                vatRate: 5.5,
                isSubdivisable: true,
                subdivisionUnits: 30,
                molecules: [{ id: 'MOL-01', name: 'Amoxicilline' }],
                dosage: 500,
                dosageUnit: 'mg',
                therapeuticClass: 'Antibiotiques',
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        ];

        // Inventory
        let lineIdCounter = 1000;
        this.inventory.push({
            id: `INV-${lineIdCounter++}`,
            productId: 'PROD-001',
            name: 'Amoxicilline 500mg Gélules',
            category: ItemCategory.ANTIBIOTICS,
            location: 'Étagère A-1',
            batchNumber: 'LOT-1001',
            expiryDate: '2025-11-30',
            unitPrice: 0.15,
            theoreticalQty: 120,
            actualQty: null,
        });

        PRODUCTS_DB.slice(1).forEach((product) => {
            const numBatches = Math.random() > 0.7 ? 2 : 1;
            for (let i = 0; i < numBatches; i++) {
                const theoretical = Math.floor(Math.random() * 200) + 10;
                const date = new Date();
                const daysOffset = Math.random() > 0.9 ? -10 : Math.floor(Math.random() * 500);
                date.setDate(date.getDate() + daysOffset);
                const location = MOCK_LOCATION_NAMES[Math.floor(Math.random() * MOCK_LOCATION_NAMES.length)];

                this.inventory.push({
                    id: `INV-${lineIdCounter++}`,
                    productId: product.id,
                    name: product.name,
                    category: product.category,
                    location: location,
                    batchNumber: `LOT-${Math.floor(Math.random() * 9000) + 1000}`,
                    expiryDate: date.toISOString().split('T')[0],
                    unitPrice: product.price,
                    theoreticalQty: theoretical,
                    actualQty: null,
                });
            }
        });

        // StockOut
        this.stockOutHistory = [
            {
                id: 'SORT-2025-001',
                date: new Date(Date.now() - 86400000 * 2),
                type: StockOutType.DESTRUCTION,
                createdBy: 'Pharm. Chef',
                destructionReason: DestructionReason.EXPIRY,
                items: []
            },
            {
                id: 'SORT-2025-002',
                date: new Date(Date.now() - 86400000 * 5),
                type: StockOutType.OUTGOING_LOAN,
                createdBy: 'Asst. Jean Dupont',
                partnerId: 'PART-001',
                items: []
            }
        ];
    }

    getInventory(): InventoryItem[] {
        return this.inventory;
    }

    getCatalog(): ProductDefinition[] {
        return this.catalog;
    }

    getLocations(): StockLocation[] {
        return this.locations;
    }

    getPartners(): PartnerInstitution[] {
        return this.partners;
    }

    getStockOutHistory(): StockOutTransaction[] {
        return this.stockOutHistory;
    }
}

export const pharmacyService = new PharmacyService();
