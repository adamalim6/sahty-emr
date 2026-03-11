import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    const migrationPath = path.join(__dirname, '../migrations/pg/tenant/073_fix_surveillance_trigger_bucket_time.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        for (const row of res.rows) {
            const dbName = row.datname;
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                await pool.query("BEGIN;");
                await pool.query(migrationSql);
                
                await pool.query("DELETE FROM surveillance_hour_buckets");
                
                // Let the trigger natively populate by performing a dummy UPDATE
                await pool.query(`
                    UPDATE surveillance_values_events SET bucket_start = bucket_start
                `);

                await pool.query("COMMIT;");
                console.log(`✅ ${dbName}: migration 073 and accurate cache reconstruction applied successfully.`);
            } catch (err: any) {
                await pool.query("ROLLBACK;");
                console.error(`❌ ${dbName}: ${err.message}`);
            } finally {
                await pool.end();
            }
        }
    } catch (err: any) {
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}
run();
