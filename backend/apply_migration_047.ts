
import { tenantQuery, tenantTransaction } from './db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_FILE = '047_epic_coverage_refactor.sql';

async function applyMigration() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'; // Dev Tenant
    console.log(`Applying ${MIGRATION_FILE} to tenant ${tenantId}...`);

    const sqlPath = path.join(__dirname, 'migrations/pg/tenant', MIGRATION_FILE);
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    try {
        await tenantTransaction(tenantId, async (client) => {
            await client.query(sql);
        });
        console.log("Migration applied successfully.");
    } catch (e: any) {
        console.error("Migration failed:", e);
    }
}

applyMigration().catch(console.error);
