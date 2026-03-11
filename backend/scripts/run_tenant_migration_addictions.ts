import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigrationAddictions() {
    console.log('--- Running Tenant Migrations 076 and 077 (Addictions) ---');
    
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    
    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        console.log(`Found ${res.rows.length} tenant DBs`);

        for (const row of res.rows) {
            const dbName = row.datname;
            console.log(`\nMigrating Tenant DB: ${dbName}...`);
            
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const sqlPath76 = path.join(__dirname, '../migrations/pg/tenant/076_create_patient_addictions.sql');
                const sql76 = fs.readFileSync(sqlPath76, 'utf8');
                console.log(`  Executing 076_create_patient_addictions.sql...`);
                await client.query(sql76);

                const sqlPath77 = path.join(__dirname, '../migrations/pg/tenant/077_create_addiction_history.sql');
                const sql77 = fs.readFileSync(sqlPath77, 'utf8');
                console.log(`  Executing 077_create_addiction_history.sql...`);
                await client.query(sql77);

                await client.query('COMMIT');
                console.log(`✅ Tenant DB ${dbName} Migration Successful.`);
            } catch (e) {
                await client.query('ROLLBACK');
                console.error(`❌ Tenant DB ${dbName} Migration Failed:`, e);
            } finally {
                client.release();
                await pool.end();
            }
        }
    } catch (err) {
        console.error("Global Error:", err);
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}

runTenantMigrationAddictions().catch(console.error);
