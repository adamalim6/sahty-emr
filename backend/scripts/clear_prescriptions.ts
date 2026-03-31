import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

require('dotenv').config();

const globalPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'sahty_global'
});

async function run() {
    const res = await globalPool.query(`SELECT id FROM tenants WHERE 1=1`);
    const tenants = res.rows;
    for (const t of tenants) {
        const tenantDb = `tenant_${t.id}`;
        console.log(`Clearing prescriptions in ${tenantDb}...`);
        const tp = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: tenantDb
        });
        try {
            await tp.query('TRUNCATE TABLE prescriptions CASCADE');
            console.log(`✅ Cleared ${tenantDb}`);
        } catch(e: any) {
            console.error(`❌ Error in ${tenantDb}:`, e.message);
        }
        await tp.end();
    }
    await globalPool.end();
}
run().catch(console.error);
