import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    // Config: using standard dev credentials as seen in other scripts
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    
    // Path to the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/pg/tenant/071_fix_surv_trigger_admission.sql');
    
    console.log(`Reading migration from: ${migrationPath}`);
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    try {
        // Find all tenant databases
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        console.log(`Found ${res.rows.length} tenant DBs`);
        
        for (const row of res.rows) {
            const dbName = row.datname;
            console.log(`Processing ${dbName}...`);
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                // Ensure auth triggers don't stop migration execution
                await pool.query("BEGIN;");
                await pool.query(migrationSql);
                await pool.query("COMMIT;");
                console.log(`✅ ${dbName}: migration 071 applied successfully.`);
            } catch (err: any) {
                await pool.query("ROLLBACK;");
                console.error(`❌ ${dbName}: ${err.message}`);
                // Don't stop entirely on error, so other tenants get it
            } finally {
                await pool.end();
            }
        }
    } catch (err: any) {
        console.error("Global Error:", err);
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}
run();
