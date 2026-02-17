import * as fs from 'fs';
import * as path from 'path';
import { tenantQuery } from './db/tenantPg';

// Replace with your actual tenant ID or pass it as an argument
const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2'; 

async function run() {
    try {
        console.log(`Applying migration 031 to tenant ${TENANT_ID}...`);
        const migrationPath = path.join(__dirname, '../migrations/pg/tenant/031_update_patient_status.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        
        // Simple split by semicolon (assumes no semicolons in string literals)
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        
        for (const stmt of statements) {
            if (stmt.trim().startsWith('--')) continue; 
            console.log('Executing:', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
            await tenantQuery(TENANT_ID, stmt);
        }
        
        console.log('Migration 031 applied successfully!');
        
        process.exit(0);
    } catch (e: any) {
        console.error('Migration failed:', e.message);
        console.error(e);
        process.exit(1);
    }
}

run();
