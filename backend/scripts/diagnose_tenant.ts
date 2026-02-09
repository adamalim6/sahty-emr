
import { getTenantPool } from '../db/tenantPg';

async function checkTenantSchema(tenantId: string) {
    console.log(`Checking schema for tenant ${tenantId}...`);
    const pool = getTenantPool(tenantId);
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'patients_tenant'
        `);
        console.log('Columns in patients_tenant:');
        res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
    } catch (e) {
        console.error('Error checking schema:', e);
    } finally {
        client.release();
    }
}

checkTenantSchema('3f6d16da-1989-4f9f-8da3-16816b4ddda0').catch(console.error);
