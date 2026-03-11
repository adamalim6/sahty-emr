import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { globalAdminService } from './services/globalAdminService';
import { getTenantPool } from './db/tenantPg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        console.log('Fetching all tenants...');
        const tenants = await globalAdminService.getAllTenants();
        console.log(`Found ${tenants.length} tenants.`);

        const migrationPath = path.join(__dirname, 'migrations', 'pg', 'tenant', '075_add_allergy_names.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        for (const tenant of tenants) {
            console.log(`Applying to tenant: ${tenant.id} (${tenant.name})`);
            const pool = getTenantPool(tenant.id);
            try {
                await pool.query(sql);
                console.log(`✅ Success for tenant ${tenant.id}`);
            } catch (err: any) {
                console.error(`❌ Failed for tenant ${tenant.id} (${tenant.name}): ${err.message}`);
                // Proceed to next tenant even if one fails
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
