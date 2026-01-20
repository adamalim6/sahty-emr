
import fs from 'fs';
import path from 'path';

// Define paths
const DATA_DIR = path.join(__dirname, '../data/global'); // Adjusted path from backend/scripts/ to backend/data/global
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json'); // Assumed filename
const DCI_FILE = path.join(DATA_DIR, 'dci.json'); // Assumed filename

// If files are in a different location (using TenantStore logic?), we might need to verify.
// The TenantStore usually defaults to `data/<tenantId>/<key>.json`.
// Global store uses `data/global/...`.
// Let's assume standard structure.

const runMigration = () => {
    console.log('Starting ATC Code Migration...');

    if (!fs.existsSync(DCI_FILE) || !fs.existsSync(PRODUCTS_FILE)) {
        console.error('Data files not found. Checked:', DCI_FILE, PRODUCTS_FILE);
        // Fallback checks
        return;
    }

    const dcis = JSON.parse(fs.readFileSync(DCI_FILE, 'utf-8'));
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));

    console.log(`Loaded ${dcis.length} DCIs and ${products.length} Products.`);

    // 1. Build DCI Map (ID -> ATC Code)
    const dciMap = new Map<string, string>();
    let atcCount = 0;
    dcis.forEach((d: any) => {
        // Handle both snake_case (legacy) and camelCase (new)
        const code = d.atcCode || d.atc_code;
        if (code) {
            dciMap.set(d.id, code);
            atcCount++;
        }
    });
    console.log(`Found ${atcCount} DCIs with ATC codes.`);

    // 2. Iterate Products
    let updatedCount = 0;
    const updatedProducts = products.map((p: any) => {
        if (!p.dciComposition || !Array.isArray(p.dciComposition)) return p;

        let changed = false;
        const newComposition = p.dciComposition.map((comp: any) => {
            // If already has atcCode, keep it (or overwrite? User wants "linked" -> Sync is better)
            // Let's overwrite to ensure consistency with Registry.
            const registryCode = dciMap.get(comp.dciId);
            
            if (registryCode && comp.atcCode !== registryCode) {
                changed = true;
                return { ...comp, atcCode: registryCode };
            }
            return comp;
        });

        if (changed) {
            updatedCount++;
            return { ...p, dciComposition: newComposition, updatedAt: new Date().toISOString() };
        }
        return p;
    });

    // 3. Save if changes
    if (updatedCount > 0) {
        console.log(`Updating ${updatedCount} products...`);
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(updatedProducts, null, 2));
        console.log('Migration Complete.');
    } else {
        console.log('No products needed updates.');
    }
};

runMigration();
