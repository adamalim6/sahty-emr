import { tenantTransaction } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    console.log('='.repeat(70));
    console.log('MIGRATING SURVEILLANCE PERSISTENCE TO STRICT EAV (057)');
    console.log('='.repeat(70));

    const sqlPath = path.join(__dirname, '../migrations/pg/tenant/057_final_surveillance_persistence.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Fetch all active tenants from sahty_global
    const tenants = await globalQuery('SELECT id FROM tenants');
    const tenantIds = tenants.map((r: any) => r.id);
    console.log(`Found ${tenantIds.length} active tenants.`);

    for (const tenantId of tenantIds) {
        console.log(`\nMigrating tenant: ${tenantId}...`);
        try {
            await tenantTransaction(tenantId, async (client) => {
                await client.query(sqlContent);
            });
            console.log(` ✅ Success for ${tenantId}`);
        } catch (e: any) {
            console.error(` ❌ Error migrating ${tenantId}:`, e.message);
            if (e.message.includes('relation "surveillance_values_events" already exists')) {
                 console.log("   (Already migrated)");
            } else {
                 throw e;
            }
        }
    }
    
    console.log('\nMigration complete.');
    process.exit(0);
}

runMigration().catch(console.error);
