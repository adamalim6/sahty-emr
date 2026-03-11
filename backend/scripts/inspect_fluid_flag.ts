import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    console.log("Checking requires_fluid_info for all Transfusion events...");
    const res = await pool.query(`
            SELECT pe.id as pe_id, pe.requires_fluid_info, p.prescription_type
            FROM administration_events ae
            JOIN prescription_events pe ON ae.prescription_event_id = pe.id
            JOIN prescriptions p ON pe.prescription_id = p.id
            WHERE ae.id = 'dd305332-4839-4252-aed6-907ef4de717a'
    `);
    console.table(res.rows);

    process.exit(0);
}
run();
