import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigrationToTenants() {
    console.log('--- Applying Migration 061 to All Active Tenants ---');
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        const sqlPath = path.join(__dirname, '../migrations/pg/tenant/061_create_care_categories.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Fetch all databases that start with "tenant_"
        const res = await client.query(`
            SELECT datname
            FROM pg_database
            WHERE datname LIKE 'tenant_%'
            AND datistemplate = false
        `);
        
        const dbs = res.rows.map(row => row.datname);
        console.log(`Found ${dbs.length} tenant databases:`, dbs);

        for (const db of dbs) {
            console.log(`\nApplying to database ${db}...`);
            
            const { Pool } = require('pg');
            const tenantPool = new Pool({
                host: process.env.PG_HOST || 'localhost',
                port: parseInt(process.env.PG_PORT || '5432'),
                database: db,
                user: process.env.PG_USER || 'sahty',
                password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            });
            const tClient = await tenantPool.connect();
            
            try {
                await tClient.query('BEGIN');
                await tClient.query(sql);
                await tClient.query('COMMIT');
                console.log(`✅ Success for database ${db}`);
            } catch(e) {
                await tClient.query('ROLLBACK');
                console.error(`❌ Failed for database ${db}:`, e);
            } finally {
                tClient.release();
                await tenantPool.end();
            }
        }
        
    } catch (e) {
        console.error('Migration framework failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

applyMigrationToTenants().catch(console.error);
