import { Client } from 'pg';

async function main() {
    const dbs = ['sahty_global', 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'];
    
    for (const dbName of dbs) {
        const schemaAndTable = dbName === 'sahty_global' ? 'public.global_products' : 'reference.global_products';
        const client = new Client({
             user: 'sahty', host: 'localhost', database: dbName, password: 'sahty_dev_2026', port: 5432,
        });
        await client.connect();
        
        const res = await client.query(`SELECT id, name, dci_composition FROM ${schemaAndTable} WHERE dci_composition IS NOT NULL`);
        let failedCount = 0;
        let validCount = 0;

        for (const row of res.rows) {
            let composition: any[];
            if (typeof row.dci_composition === 'string') {
                try { composition = JSON.parse(row.dci_composition); } catch (e) { continue; }
            } else {
                composition = row.dci_composition;
            }
            if (!Array.isArray(composition)) continue;

            for (const comp of composition) {
                // If the old keys 'dosage' or 'unit' or 'presentation' still exist, or new keys are missing
                if ('dosage' in comp || 'unit' in comp || 'presentation' in comp || !('amount_value' in comp) || !('amount_unit_id' in comp)) {
                    failedCount++;
                    break; // Count product once
                }
            }
            if (!composition.some(c => 'dosage' in c || 'unit' in c || 'presentation' in c || !('amount_value' in c) || !('amount_unit_id' in c))) {
                validCount++;
            }
        }
        
        console.log(`Database: ${dbName}`);
        console.log(`  - Successfully Migrated Products: ${validCount}`);
        console.log(`  - Failed / Unmigrated Products:    ${failedCount}`);
        await client.end();
    }
}
main().catch(console.error);
