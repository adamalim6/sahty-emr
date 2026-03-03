import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const globalPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function run() {
    const tenantsRes = await globalPool.query('SELECT tenant_db_name FROM tenants WHERE is_active = true');
    const sql = fs.readFileSync('backend/migrations/pg/tenant/057_final_surveillance_persistence.sql', 'utf8');

    for (const row of tenantsRes.rows) {
        const dbName = row.tenant_db_name;
        console.log(`Migrating ${dbName}...`);
        const pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: dbName,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
        });
        
        try {
            await pool.query(sql);
            console.log(`  Success`);
        } catch (e) {
            console.error(`  Error:`, e);
        } finally {
            await pool.end();
        }
    }
    await globalPool.end();
}
run();
