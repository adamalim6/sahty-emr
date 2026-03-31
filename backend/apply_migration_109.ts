import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

async function run() {
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map((row: any) => row.datname);
    await globalPool.end();

    console.log(`Found ${tenantDatabases.length} tenant databases. Applying schema update 109...`);

    const sqlPath = path.join(__dirname, 'migrations', 'pg', 'tenant', '109_rebuild_lab_requests_tenant.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf-8');

    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const pool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await pool.query('BEGIN');
            await pool.query(sqlScript);
            await pool.query('COMMIT');
        } catch (e) {
            await pool.query('ROLLBACK');
            console.error(e);
        } finally {
            await pool.end();
        }
    }
    console.log('Done 109!');
}

run();
