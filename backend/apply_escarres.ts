import { tenantQuery, tenantTransaction } from './db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_FILE = '063_create_escarres.sql';

async function applyMigration() {
    // Standard dev tenant
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'; 
    console.log(`Applying ${MIGRATION_FILE} to tenant ${tenantId}...`);

    const sqlPath = path.join(__dirname, 'migrations/pg/tenant', MIGRATION_FILE);
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    try {
        await tenantTransaction(tenantId, async (client) => {
            await client.query(sql);
        });
        console.log("Migration applied successfully.");
        process.exit(0);
    } catch (e: any) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

applyMigration();
