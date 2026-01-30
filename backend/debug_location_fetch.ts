
import { getTenantPool } from './db/tenantPg';

async function debugLocations() {
    const tenantId = '36dff8fa-4729-4c10-a0bf-712be63cc9b2'; // From screenshot
    const serviceId = '9968b988-cac0-4751-a0f3-6c603383a876'; // From screenshot for Cardiologie
    
    console.log(`Checking locations for tenant: ${tenantId}, service: ${serviceId}`);

    const pool = getTenantPool(tenantId);

    // 1. Raw query for all locations
    console.log('\n--- 1. RAW DUMP of locations table ---');
    const res1 = await pool.query('SELECT location_id, name, type, scope, service_id FROM locations');
    console.table(res1.rows);

    // 2. Simulate Service Query
    console.log('\n--- 2. Simulated Query (scope=SERVICE) ---');
    const query = `SELECT location_id, name, type, scope, service_id FROM locations WHERE tenant_id = $1 AND service_id = $2 AND scope = 'SERVICE'`;
    const res2 = await pool.query(query, [tenantId, serviceId]);
    console.table(res2.rows);

    // 3. Simulate Query without scope
    console.log('\n--- 3. Simulated Query (no scope filter) ---');
    const query3 = `SELECT location_id, name, type, scope, service_id FROM locations WHERE tenant_id = $1 AND service_id = $2`;
    const res3 = await pool.query(query3, [tenantId, serviceId]);
    console.table(res3.rows);

    process.exit(0);
}

debugLocations().catch(console.error);
