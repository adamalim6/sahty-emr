import * as fs from 'fs';
import * as path from 'path';
import { tenantQuery } from './db/tenantPg';

const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'; 

async function run() {
    try {
        console.log(`Applying migration 037 to tenant ${TENANT_ID}...`);
        const migrationPath = path.join(__dirname, '../migrations/pg/tenant/037_add_sort_order_constraints.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        
        await tenantQuery(TENANT_ID, sql);
        
        console.log('Migration 037 applied successfully!');
        
        process.exit(0);
    } catch (e: any) {
        console.error('Migration failed:', e.message);
        console.error(e);
        process.exit(1);
    }
}

run();
