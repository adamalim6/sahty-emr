import * as fs from 'fs';
import * as path from 'path';
import { tenantQuery } from './db/tenantPg';

// Replace with your actual tenant ID or pass it as an argument
const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2'; 

async function run() {
    try {
        console.log(`Applying migration 030 to tenant ${TENANT_ID}...`);
        const migrationPath = path.join(__dirname, '../migrations/pg/tenant/030_add_reference_organismes_countries.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        
        // Simple split by semicolon (assumes no semicolons in string literals)
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        
        for (const stmt of statements) {
            if (stmt.trim().startsWith('--')) continue; // Skip comments-only chunks
            console.log('Executing:', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
            await tenantQuery(TENANT_ID, stmt);
        }
        
        console.log('Migration 030 applied successfully!');
        
        // Verify Content
        const orgCount = await tenantQuery(TENANT_ID, 'SELECT COUNT(*) FROM reference.organismes');
        const countryCount = await tenantQuery(TENANT_ID, 'SELECT COUNT(*) FROM reference.countries');
        
        console.log(`\nVerification Results:`);
        console.log(`- Organismes count: ${orgCount[0].count}`);
        console.log(`- Countries count: ${countryCount[0].count}`);
        
        process.exit(0);
    } catch (e: any) {
        console.error('Migration failed:', e.message);
        console.error(e);
        process.exit(1);
    }
}

run();
