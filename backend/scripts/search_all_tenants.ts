import { query } from '../db/pg';
import { getTenantPool } from '../db/tenantPg';

async function run() {
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087';
    try {
        const schemasRes = await query(`
            SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%';
        `);
        console.log(`Found ${schemasRes.rows.length} tenant databases`);
        
        for (const row of schemasRes.rows) {
            const dbName = row.datname;
            const tenantId = dbName.replace('tenant_', '').replace(/_/g, '-');
            
            try {
                const tenantPool = getTenantPool(tenantId);
                const client = await tenantPool.connect();
                try {
                    const res = await client.query(`
                        SELECT id, prescription_type, status, details 
                        FROM public.prescriptions 
                        WHERE tenant_patient_id = $1
                    `, [patientId]);
                    
                    if (res.rows.length > 0) {
                        console.log(`\n--- Found in DB: ${dbName} ---`);
                        console.log(JSON.stringify(res.rows, null, 2));
                    }
                } finally {
                    client.release();
                }
            } catch(e) {
                // ignore
            }
        }
    } catch (e) {
        console.error('Global error:', e);
    } finally {
        process.exit();
    }
}

run();
