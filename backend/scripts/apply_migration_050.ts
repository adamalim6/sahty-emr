
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    // Config: using standard dev credentials as seen in other scripts
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    
    // Path to the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/pg/tenant/050_admission_enhancements.sql');
    
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
                await pool.query(migrationSql);
                console.log(`✅ ${dbName}: migration 050 applied`);
            } catch (err: any) {
                console.error(`❌ ${dbName}: ${err.message}`);
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
