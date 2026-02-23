import { getTenantPool } from '../db/tenantPg';

async function listAllTables() {
    const tenantId = '33333333-4444-5555-6666-777777777777';
    const pool = getTenantPool(tenantId);
    
    try {
        const res = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
        `);
        console.log("ALL TABLES IN DB:");
        res.rows.forEach(r => console.log(`- ${r.table_schema}.${r.table_name}`));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

listAllTables();
