import * as fs from 'fs';
import * as path from 'path';
import { tenantQuery } from './db/tenantPg';

const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'; 

async function run() {
    try {
        console.log(`Applying migration 036 to tenant ${TENANT_ID}...`);
        const migrationPath = path.join(__dirname, '../migrations/pg/tenant/036_add_prescription_pause_stop.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        
        // Simple split by semicolon (assumes no semicolons in string literals)
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        
        for (const stmt of statements) {
            if (stmt.trim().startsWith('--')) continue; 
            console.log('Executing:', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
            await tenantQuery(TENANT_ID, stmt);
        }
        
        console.log('Migration 036 applied successfully!');
        
        process.exit(0);
    } catch (e: any) {
        console.error('Migration failed:', e.message);
        console.error(e);
        process.exit(1);
    }
}

run();
