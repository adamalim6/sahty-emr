
import * as fs from 'fs';
import * as path from 'path';
import { TenantStore } from '../utils/tenantStore';

const TENANT_A = 'tenant_a_test_iso';
const TENANT_B = 'tenant_b_test_iso';
// Determine DATA_DIR relative to where script is run? 
// Assuming run from project root: backend/scripts/verify_isolation.ts -> process.cwd()/backend/data/tenants
// TenantStore uses path.join(__dirname, '../data') from its location in utils/
// Utils is backend/utils. So backend/data.
// So we should check backend/data.

const DATA_DIR = path.join(__dirname, '../data/tenants'); 

console.log('--- STARTING ISOLATION VERIFICATION ---');

async function run() {
    try {
        // 0. Ensure Clean Slate (Optional, but good for test)
        // We won't wipe ALL tenants, just our test ones
        const dirA = path.join(DATA_DIR, TENANT_A);
        const dirB = path.join(DATA_DIR, TENANT_B);
        if(fs.existsSync(dirA)) fs.rmSync(dirA, {recursive: true, force: true});
        if(fs.existsSync(dirB)) fs.rmSync(dirB, {recursive: true, force: true});

        // 1. Write to Tenant A
        console.log(`[Step 1] Writing Isolation Marker to Tenant A (${TENANT_A})...`);
        const storeA = new TenantStore(TENANT_A);
        storeA.save('pharmacy', { 
            inventory: [{ productId: 'MARKER_A', quantity: 100 }] 
        } as any);

        // 2. Write to Tenant B
        console.log(`[Step 2] Writing Isolation Marker to Tenant B (${TENANT_B})...`);
        const storeB = new TenantStore(TENANT_B);
        storeB.save('pharmacy', { 
            inventory: [{ productId: 'MARKER_B', quantity: 999 }] 
        } as any);

        // 3. Verify Files exist
        const fileA = path.join(dirA, 'pharmacy.json');
        const fileB = path.join(dirB, 'pharmacy.json');

        if (!fs.existsSync(fileA)) throw new Error(`FAIL: File A missing at ${fileA}`);
        console.log(`[Check] File A exists: ${fileA}`);
        
        if (!fs.existsSync(fileB)) throw new Error(`FAIL: File B missing at ${fileB}`);
        console.log(`[Check] File B exists: ${fileB}`);

        // 4. Verify Content Isolation
        const contentA = JSON.parse(fs.readFileSync(fileA, 'utf8'));
        const contentB = JSON.parse(fs.readFileSync(fileB, 'utf8'));

        console.log(`[Check] Content A Marker: ${contentA.inventory?.[0]?.productId}`);
        console.log(`[Check] Content B Marker: ${contentB.inventory?.[0]?.productId}`);

        if (contentA.inventory[0].productId !== 'MARKER_A') throw new Error('FAIL: Content A does NOT match expected marker.');
        if (contentB.inventory[0].productId !== 'MARKER_B') throw new Error('FAIL: Content B does NOT match expected marker.');
        
        if (contentA.inventory[0].productId === 'MARKER_B') throw new Error('CRITICAL FAIL: Tenant A has Tenant B data!');
        
        console.log('SUCCESS: Physical Isolation Confirmed. Tenants have separate files and correct data.');

    } catch (error: any) {
        console.error("VERIFICATION FAILED:", error);
        process.exit(1);
    }
}

run();
