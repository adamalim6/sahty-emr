
import * as fs from 'fs';
import * as path from 'path';

// Paths
const DATA_DIR = path.join(__dirname, 'backend/data');
const DB_FILE = path.join(DATA_DIR, 'pharmacy_db.json');

// Ensure dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 1. Products (Catalog)
const products = [
    { id: 'PROD-001', name: 'Amoxicilline 500mg Gélules', category: 'Antibiotiques', price: 0.15, unitsPerPack: 12, minStock: 20 },
    { id: 'PROD-002', name: 'Paracétamol 1g IV', category: 'Antalgiques', price: 2.50, unitsPerPack: 10, minStock: 50 },
    { id: 'PROD-003', name: 'Atorvastatine 20mg', category: 'Cardiologie', price: 0.45, unitsPerPack: 28, minStock: 15 },
    { id: 'PROD-004', name: 'Sérum Salé 0.9% 1L', category: 'Solutés', price: 1.20, unitsPerPack: 1, minStock: 100 },
    { id: 'PROD-005', name: 'Gants Chirurgicaux 7.5', category: 'Consommables', price: 0.30, unitsPerPack: 50, minStock: 200 },
    { id: 'PROD-006', name: 'Sulfate de Morphine 10mg/ml', category: 'Stupéfiants', price: 4.00, unitsPerPack: 5, minStock: 10 },
    { id: 'PROD-007', name: 'Ceftriaxone 1g Inj', category: 'Antibiotiques', price: 3.10, unitsPerPack: 1, minStock: 30 },
];

// 2. Locations
const locations = [
    { id: 'LOC-001', name: 'Réfrigérateur 1', type: 'FRIDGE', temperature: '2-8°C' },
    { id: 'LOC-002', name: 'Étagère A-1', type: 'SHELF', temperature: 'Ambiante' },
    { id: 'LOC-003', name: 'Armoire Sécurisée', type: 'SAFE', temperature: 'Ambiante' },
];

// 3. Inventory & Serialized Packs
const inventory: any[] = [];
const serializedPacks: any[] = [];

products.forEach(prod => {
    // Create random stock
    const qty = Math.floor(Math.random() * 50) + 10; // 10 to 60 packs
    const batchNum = Math.floor(Math.random() * 10000).toString();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1); // Expire next year

    const locId = prod.category === 'Solutés' ? 'LOC-002' : (prod.category === 'Stupéfiants' ? 'LOC-003' : 'LOC-001'); // Simple logic

    // Add to Inventory (Aggregate)
    const invId = `INV-${Date.now()}-${prod.id}`;
    inventory.push({
        id: invId,
        productId: prod.id,
        name: prod.name,
        category: prod.category,
        location: locId,
        batchNumber: batchNum,
        expiryDate: expiry.toISOString().split('T')[0],
        unitPrice: prod.price,
        theoreticalQty: qty * prod.unitsPerPack,
        actualQty: null,
        lastUpdated: new Date()
    });

    // Create Serialized Packs
    for (let i = 0; i < qty; i++) {
        serializedPacks.push({
            id: `PACK-${prod.id}-${i}-${Date.now()}`,
            productId: prod.id,
            locationId: locId,
            status: 'SEALED',
            batchNumber: batchNum,
            lotNumber: batchNum,
            expiryDate: expiry,
            unitsPerPack: prod.unitsPerPack,
            remainingUnits: prod.unitsPerPack,
            createdAt: new Date(),
            updatedAt: new Date(),
            history: []
        });
    }
});

// 4. Update products with stock info (for consistency if backend reads it)
const catalog = products.map(p => ({
    ...p,
    currentStock: serializedPacks.filter(pack => pack.productId === p.id).length, // Box count
    suppliers: [{ id: 'SUP-001', name: 'Afric-Phar', purchasePrice: p.price, isActive: true }],
    createdAt: new Date(),
    updatedAt: new Date(),
    description: p.name,
    vatRate: 20,
    profitMargin: 30
}));

// 5. Final Data Object
const data = {
    inventory: inventory,
    catalog: catalog,
    locations: locations,
    partners: [],
    replenishmentRequests: [],
    dispensations: [],
    stockOutHistory: [],
    purchaseOrders: [],
    deliveryNotes: [],
    serializedPacks: serializedPacks,
    suppliers: [{ id: 'SUP-001', name: 'Afric-Phar', isActive: true, createdAt: new Date(), updatedAt: new Date() }]
};

// Write
fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
console.log(`Successfully seeded ${DB_FILE}`);
console.log(`- ${catalog.length} Products`);
console.log(`- ${inventory.length} Inventory Lines`);
console.log(`- ${serializedPacks.length} Serialized Packs`);
