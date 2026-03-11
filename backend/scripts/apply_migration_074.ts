import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    const migrationPath = path.join(__dirname, '../migrations/pg/tenant/074_create_patient_allergies.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        for (const row of res.rows) {
            const dbName = row.datname;
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                await pool.query(migrationSql);
                console.log(`✅ ${dbName}: migration 074 applied successfully.`);
            } catch (err: any) {
                console.error(`❌ ${dbName}: ${err.message}`);
            } finally {
                await pool.end();
            }
        }
    } catch (err: any) {
        console.error("Global Error: ", err.message);
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}

run();
