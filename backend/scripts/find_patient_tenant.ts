import { Pool } from 'pg';

async function run() {
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087';
    const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895' });
    try {
        const pat = await pool.query("SELECT id, tenant_id FROM tenant_patients WHERE id = $1", [patientId]);
        console.log("PATIENT QUERY RESULT:", pat.rows);
        
        const allPatients = await pool.query("SELECT id, external_patient_id FROM tenant_patients");
        console.log("ALL PATIENTS IN TENANT:", allPatients.rows);
    } catch(e: any) {
        console.error("ERROR from tenant_patients query:", e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
