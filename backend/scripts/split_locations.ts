import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data/tenants');

function migrate() {
    console.log("Starting locations split migration...");
    
    if (!fs.existsSync(DATA_DIR)) {
        console.error("Data directory not found:", DATA_DIR);
        return;
    }

    const tenants = fs.readdirSync(DATA_DIR);

    tenants.forEach(tenantId => {
        if (!tenantId.startsWith('client_')) return;

        const tenantPath = path.join(DATA_DIR, tenantId);
        const locationsPath = path.join(tenantPath, 'pharmacy/locations.json');

        if (fs.existsSync(locationsPath)) {
            console.log(`Processing tenant: ${tenantId}`);
            
            try {
                const rawData = fs.readFileSync(locationsPath, 'utf-8');
                const locations = JSON.parse(rawData);

                if (!Array.isArray(locations)) {
                    console.warn(`WARNING: locations.json for ${tenantId} is not an array. Skipping.`);
                    return;
                }

                const pharmacyLocs = locations.filter((l: any) => l.scope === 'PHARMACY');
                const deptLocs = locations.filter((l: any) => l.scope === 'SERVICE');

                // Write new files
                const pharmPath = path.join(tenantPath, 'pharmacy/pharmacy_locations.json');
                const deptPath = path.join(tenantPath, 'pharmacy/department_locations.json');

                fs.writeFileSync(pharmPath, JSON.stringify(pharmacyLocs, null, 4));
                fs.writeFileSync(deptPath, JSON.stringify(deptLocs, null, 4));

                console.log(`  Saved ${pharmacyLocs.length} pharmacy locations.`);
                console.log(`  Saved ${deptLocs.length} department locations.`);

                // Archive old file
                const archivePath = path.join(tenantPath, `pharmacy/locations.json.OLD.${Date.now()}`);
                fs.renameSync(locationsPath, archivePath);
                console.log(`  Archived locations.json to ${path.basename(archivePath)}`);

            } catch (err) {
                console.error(`ERROR processing ${tenantId}:`, err);
            }
        }
    });

    console.log("Migration complete.");
}

migrate();
