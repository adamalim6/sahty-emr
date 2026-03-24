import fs from 'fs';
import path from 'path';
import { globalAdminService } from './services/globalAdminService';
import { getTenantPool } from './db/tenantPg';

async function run() {
    try {
        console.log('Fetching all tenants...');
        const tenants = await globalAdminService.getAllTenants();
        console.log(`Found ${tenants.length} tenants.`);

        const migrationPath = path.join(__dirname, 'migrations', 'pg', 'tenant', '093_patient_documents_refactor_tenant.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        for (const tenant of tenants) {
            console.log(`Applying to tenant: ${tenant.id} (${tenant.name})`);
            const pool = getTenantPool(tenant.id);
            try {
                // To safely apply this, run it in a transaction if needed, but the current SQL should be fine
                await pool.query(sql);
                console.log(`✅ Success for tenant ${tenant.id}`);
            } catch (err: any) {
                console.error(`❌ Failed for tenant ${tenant.id} (${tenant.name}): ${err.message}`);
            }
            // End the pool so script can exit
            await pool.end();
        }

        console.log('All done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
