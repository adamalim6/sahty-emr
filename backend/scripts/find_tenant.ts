import { Pool } from 'pg';

const globalPool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/sahty_global',
});

async function run() {
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087';
    try {
        const client = await globalPool.connect();
        const res = await client.query(`SELECT tenant_id FROM patients_global WHERE id = $1`, [patientId]);
        console.log('Tenant for patient:', res.rows[0]?.tenant_id);
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        globalPool.end();
        process.exit();
    }
}

run();
