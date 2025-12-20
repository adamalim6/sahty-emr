
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

const pharmacyDbPath = path.join(dataDir, 'pharmacy_db.json');
const emrDbPath = path.join(dataDir, 'emr_db.json');
const prescriptionsDbPath = path.join(dataDir, 'prescriptions_db.json');

const emptyPharmacyDb = {
    catalog: [],
    inventory: [],
    serializedPacks: [],
    locations: [],
    partners: [],
    suppliers: [],
    replenishmentRequests: [],
    dispensations: [],
    stockOutHistory: [],
    purchaseOrders: [],
    deliveryNotes: []
};

const emptyEmrDb = {
    patients: [],
    admissions: [],
    appointments: [],
    rooms: []
};

// Prescriptions in this file seem to be just an array of objects
const emptyPrescriptionsDb = [];

console.log('Resetting database files...');

fs.writeFileSync(pharmacyDbPath, JSON.stringify(emptyPharmacyDb, null, 2));
console.log('✓ Pharmacy DB reset');

fs.writeFileSync(emrDbPath, JSON.stringify(emptyEmrDb, null, 2));
console.log('✓ EMR DB reset');

fs.writeFileSync(prescriptionsDbPath, JSON.stringify(emptyPrescriptionsDb, null, 2));
console.log('✓ Prescriptions DB reset');

console.log('All data cleared successfully.');
