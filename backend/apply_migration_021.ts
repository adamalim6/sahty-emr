import * as fs from 'fs';
import * as path from 'path';
import { tenantQuery } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function run() {
    try {
        const migrationPath = path.join(__dirname, '../migrations/pg/tenant/021_return_decisions_locations.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        
        // Split by semicolons and execute each statement
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        
        for (const stmt of statements) {
            console.log('Executing:', stmt.substring(0, 60) + '...');
            await tenantQuery(TENANT_ID, stmt);
        }
        
        console.log('Migration 021 applied successfully!');
        
        // Verify locations
        const locs = await tenantQuery(TENANT_ID, `SELECT name, type, scope, location_class, valuation_policy, status FROM locations WHERE scope = 'SYSTEM' OR name IN ('WASTE', 'RETURN_QUARANTINE')`);
        console.log('\nSystem Locations:', locs);
        
        // Check return_decision_lines columns
        const cols = await tenantQuery(TENANT_ID, `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'return_decision_lines'`);
        console.log('\nreturn_decision_lines columns:', cols);
        
        process.exit(0);
    } catch (e: any) {
        console.error('Migration failed:', e.message);
        process.exit(1);
    }
}

run();
