import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'backend/data/pharmacy_db.json');

// Complete fresh data
const data = {
    "catalog": [
        {
            "id": "PROD-001",
            "name": "Amoxicilline 500mg Gélules",
            "type": "DRUG",
            "isSubdivisable": true,
            "unitsPerPack": 12,
            "minStock": 20,
            "currentStock": 0,
            "suppliers": [{ "id": "SUP-001", "name": "Afric-Phar", "purchasePrice": 0.15, "leadTimeDays": 2, "isActive": true }],
            "vatRate": 20,
            "profitMargin": 30,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString(),
            "description": "Amoxicilline 500mg Gélules"
        },
        {
            "id": "PROD-002",
            "name": "Paracétamol 1g IV",
            "type": "DRUG",
            "isSubdivisable": true,
            "unitsPerPack": 10,
            "minStock": 50,
            "currentStock": 0,
            "suppliers": [{ "id": "SUP-001", "name": "Afric-Phar", "purchasePrice": 2.50, "leadTimeDays": 2, "isActive": true }],
            "vatRate": 20,
            "profitMargin": 30,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString(),
            "description": "Paracétamol 1g IV"
        },
        {
            "id": "PROD-003",
            "name": "Atorvastatine 20mg",
            "type": "DRUG",
            "isSubdivisable": true,
            "unitsPerPack": 28,
            "minStock": 15,
            "currentStock": 0,
            "suppliers": [{ "id": "SUP-001", "name": "Afric-Phar", "purchasePrice": 0.45, "leadTimeDays": 2, "isActive": true }],
            "vatRate": 20,
            "profitMargin": 30,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString(),
            "description": "Atorvastatine 20mg"
        }
    ],
    "inventory": [
        {
            "id": "INV-001",
            "productId": "PROD-001",
            "name": "Amoxicilline 500mg Gélules",
            "category": "Antibiotiques",
            "location": "LOC-100",
            "batchNumber": "BATCH001",
            "expiryDate": "2025-12-31",
            "unitPrice": 0.15,
            "theoreticalQty": 120,
            "actualQty": null,
            "lastUpdated": new Date().toISOString()
        },
        {
            "id": "INV-002",
            "productId": "PROD-002",
            "name": "Paracétamol 1g IV",
            "category": "Antalgiques",
            "location": "LOC-100",
            "batchNumber": "BATCH002",
            "expiryDate": "2026-01-31",
            "unitPrice": 2.50,
            "theoreticalQty": 200,
            "actualQty": null,
            "lastUpdated": new Date().toISOString()
        }
    ],
    "serializedPacks": [
        {
            "id": "PACK-001-1",
            "productId": "PROD-001",
            "locationId": "LOC-100",
            "status": "SEALED",
            "batchNumber": "BATCH001",
            "lotNumber": "BATCH001",
            "expiryDate": "2025-12-31",
            "unitsPerPack": 12,
            "remainingUnits": 12,
            "serialNumber": "SN001-1",
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString(),
            "history": []
        },
        {
            "id": "PACK-001-2",
            "productId": "PROD-001",
            "locationId": "LOC-100",
            "status": "SEALED",
            "batchNumber": "BATCH001",
            "lotNumber": "BATCH001",
            "expiryDate": "2025-12-31",
            "unitsPerPack": 12,
            "remainingUnits": 12,
            "serialNumber": "SN001-2",
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString(),
            "history": []
        },
        {
            "id": "PACK-002-1",
            "productId": "PROD-002",
            "locationId": "LOC-100",
            "status": "SEALED",
            "batchNumber": "BATCH002",
            "lotNumber": "BATCH002",
            "expiryDate": "2026-01-31",
            "unitsPerPack": 10,
            "remainingUnits": 10,
            "serialNumber": "SN002-1",
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString(),
            "history": []
        }
    ],
    "locations": [
        { "id": "LOC-100", "name": "Étagère A-1", "type": "SHELF", "description": "Zone principale", "temperature": "Ambiante", "isActive": true },
        { "id": "LOC-101", "name": "Réfrigérateur 1", "type": "FRIDGE", "description": "Zone froide", "temperature": "2-8°C", "isActive": true }
    ],
    "partners": [],
    "suppliers": [
        {
            "id": "SUP-001",
            "name": "Afric-Phar",
            "isActive": true,
            "address": "Casablanca, Maroc",
            "contactPerson": "M. Alami",
            "phone": "+212 5 22 00 00 00",
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
        }
    ],
    "replenishmentRequests": [],
    "dispensations": [],
    "stockOutHistory": [],
    "purchaseOrders": [],
    "deliveryNotes": []
};

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
console.log('✓ Database fixed with complete data');
console.log('✓ Products:', data.catalog.length);
console.log('✓ Packs:', data.serializedPacks.length);
