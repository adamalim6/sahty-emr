
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Connect to SAHTY_EMR to list tenants
const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'sahty_emr'
});

async function run() {
    try {
        console.log('Finding tenant databases...');
        const res = await pool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const dbNames = res.rows.map(r => r.datname);
        console.log(`Found ${dbNames.length} tenant databases.`);

        const migrationSQL = fs.readFileSync(path.join(__dirname, '../../migrations/pg/tenant/011_add_demand_ref.sql'), 'utf-8');

        for (const dbName of dbNames) {
            console.log(`Migrating ${dbName}...`);

            
            const tenantPool = new Pool({
                host: process.env.PG_HOST || 'localhost',
                port: parseInt(process.env.PG_PORT || '5432'),
                user: process.env.PG_USER || 'sahty',
                password: process.env.PG_PASSWORD || 'sahty_dev_2026',
                database: dbName
            });

            try {
                await tenantPool.query(migrationSQL);
                console.log(`SUCCESS: ${dbName}`);
            } catch (e: any) {
                console.error(`FAILED: ${dbName}`, e.message);
            } finally {
                await tenantPool.end();
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
