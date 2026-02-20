
import { Pool } from 'pg';
import { getTenantDbName } from '../db/tenantPg';

const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const DB_NAME = getTenantDbName(TEST_TENANT_ID);

async function inspect() {
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: DB_NAME
    });

    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'audit_log'
            ORDER BY ordinal_position
        `);
        console.log("Columns in audit_log:");
        res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
        
        await pool.end();
    } catch(e) {
        console.error(e);
    }
}
inspect();
