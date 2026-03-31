import 'dotenv/config';
import { getGlobalPool } from '../db/globalPg';
import { tenantTransaction } from '../db/tenantPg';
import fs from 'fs';
import path from 'path';

async function main() {
    const globalPool = getGlobalPool();
    try {
        console.log("Applying Tenant Migration 106...");
        const tenantSqlPath = path.join(__dirname, '../migrations/pg/tenant/106_add_lab_act_specimen_containers_tenant.sql');
        const tenantSql = fs.readFileSync(tenantSqlPath, 'utf8');
        
        const dbsRes = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        console.log(`Found ${dbsRes.rows.length} tenant databases to update.`);
        
        for (const db of dbsRes.rows) {
            const tenantId = db.datname.replace('tenant_', '');
            console.log(`Applying to tenant: ${tenantId}`);
            try {
                await tenantTransaction(tenantId, async (client) => {
                    await client.query(tenantSql);
                });
                console.log(`✅ Success for tenant ${tenantId}`);
            } catch (err: any) {
                console.error(`❌ Error migrating tenant ${tenantId}:`, err);
            }
        }
        
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        // The script just needs to exit
        process.exit(0);
    }
}

main();
