import { getTenantPool } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    
    console.log("Querying recent events...");
    const res = await pool.query(`
            SELECT 
                ae.id,
                ae.action_type,
                ae.actual_start_at,
                ae.actual_end_at,
                ae.status,
                ae.linked_event_id,
                ae.volume_administered_ml,
                pe.requires_fluid_info,
                p.prescription_type
            FROM administration_events ae
            JOIN prescription_events pe ON ae.prescription_event_id = pe.id
            JOIN prescriptions p ON pe.prescription_id = p.id
            WHERE p.tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d'
            ORDER BY ae.created_at DESC
            LIMIT 30;
    `);
    console.table(res.rows);

    process.exit(0);
}
run();
