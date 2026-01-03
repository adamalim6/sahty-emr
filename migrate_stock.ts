
import * as fs from 'fs';
import * as path from 'path';

// Define paths
const DATA_DIR = path.join(process.cwd(), 'backend/data');
const PHARMACY_DB_FILE = path.join(DATA_DIR, 'pharmacy_db.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

// Interfaces (Partial)
interface Service {
    id: string;
    name: string;
    code: string;
    client_id: string;
}

interface StockLocation {
    id: string;
    name: string;
    serviceId?: string;
    tenantId?: string;
}

interface InventoryItem {
    id: string;
    serviceId?: string;
    tenantId?: string;
}

const migrate = () => {
    console.log('Starting Migration: Centralize Stock Emplacements...');

    if (!fs.existsSync(PHARMACY_DB_FILE)) {
        console.error('Pharmacy DB not found.');
        return;
    }

    if (!fs.existsSync(SERVICES_FILE)) {
        console.error('Services DB not found.');
        return;
    }

    // 1. Read Data
    const pharmacyData = JSON.parse(fs.readFileSync(PHARMACY_DB_FILE, 'utf-8'));
    let services: Service[] = JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'));
    let locations: StockLocation[] = pharmacyData.locations || [];
    let inventory: InventoryItem[] = pharmacyData.inventory || [];
    
    // 2. Identify "Demo Hospital" Tenant ID
    // We assume the first client or one with "demo" in name/code is the target.
    // However, the prompt says "tenant: demo hospital".
    // We will look for a client. If not found, we pick the first one or create dummy.
    let demoTenantId = 'demo-hospital-id'; // Fallback
    
    if (fs.existsSync(CLIENTS_FILE)) {
        const clients = JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf-8'));
        const found = clients.find((c: any) => c.name && (c.name.toLowerCase().includes('demo') || c.id === 'demo'));
        if (found) demoTenantId = found.id;
        else if (clients.length > 0) demoTenantId = clients[0].id;
    }
    
    console.log(`Target Tenant ID: ${demoTenantId}`);

    // 3. Find or Create "Médecine" Service for Demo Tenant
    let medService = services.find(s => 
        (s.name.toLowerCase() === 'médecine' || s.code === 'MED') && 
        s.client_id === demoTenantId
    );

    if (!medService) {
        console.log('Creating "Médecine" Service...');
        medService = {
            id: `svc_MED_${Date.now()}`,
            name: 'Médecine',
            code: 'MED',
            client_id: demoTenantId
        };
        services.push(medService);
        fs.writeFileSync(SERVICES_FILE, JSON.stringify(services, null, 2));
    } else {
        console.log(`Found "Médecine" Service: ${medService.id}`);
    }

    // 4. Update Locations
    let locsUpdated = 0;
    locations = locations.map(loc => {
        let modified = false;
        
        // If no tenantId, assign demoTenantId
        if (!loc.tenantId) {
            loc.tenantId = demoTenantId;
            modified = true;
        }

        // If no serviceId, assign to Médecine
        if (!loc.serviceId) {
            loc.serviceId = medService!.id;
            modified = true;
        }

        if (modified) locsUpdated++;
        return loc;
    });

    // 5. Update Inventory Items
    let itemsUpdated = 0;
    inventory = inventory.map(item => {
        let modified = false;

        if (!item.tenantId) {
            item.tenantId = demoTenantId;
            modified = true;
        }

        if (!item.serviceId) {
            item.serviceId = medService!.id;
            modified = true;
        }

        if (modified) itemsUpdated++;
        return item;
    });

    // 6. Save Data
    pharmacyData.locations = locations;
    pharmacyData.inventory = inventory;
    
    fs.writeFileSync(PHARMACY_DB_FILE, JSON.stringify(pharmacyData, null, 2));

    console.log(`Migration Complete.`);
    console.log(`- Locations Updated: ${locsUpdated}`);
    console.log(`- Inventory Items Updated: ${itemsUpdated}`);
    console.log(`- Target Service: ${medService.name} (${medService.id})`);
};

migrate();
