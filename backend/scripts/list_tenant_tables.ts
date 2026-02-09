
import { getTenantPool } from '../db/tenantPg';

async function listTables(tenantId: string) {
    console.log(`Listing tables for tenant ${tenantId}...`);
    const pool = getTenantPool(tenantId);
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        console.log('Tables:');
        res.rows.forEach(r => console.log(` - ${r.table_name}`));
    } finally {
        client.release();
    }
}

listTables('3f6d16da-1989-4f9f-8da3-16816b4ddda0').catch(console.error);
