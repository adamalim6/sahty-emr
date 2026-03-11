import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    console.log("Checking tenant_patient_id...");
    try {
        const transRes = await pool.query(`
                SELECT p.tenant_patient_id
                FROM administration_events ae
                JOIN prescription_events pe ON ae.prescription_event_id = pe.id
                JOIN prescriptions p ON pe.prescription_id = p.id
                WHERE ae.id = 'dd305332-4839-4252-aed6-907ef4de717a'
        `);
        console.table(transRes.rows);
    } catch (e) {
        console.error(e);
    }

    process.exit(0);
}
run();
