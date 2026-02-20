
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    const migrationSql = fs.readFileSync(path.join(__dirname, '../migrations/pg/tenant/045_add_related_phone.sql'), 'utf8');
    
    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        console.log(`Found ${res.rows.length} tenant DBs`);
        
        for (const row of res.rows) {
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: row.datname });
            try {
                await pool.query(migrationSql);
                console.log(`✅ ${row.datname}: migration 045 applied`);
            } catch (err: any) {
                console.error(`❌ ${row.datname}: ${err.message}`);
            } finally {
                await pool.end();
            }
        }
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}
run();
