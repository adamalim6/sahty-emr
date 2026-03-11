import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const tenantPatientId = '6f537c9a-e7e3-40d8-8659-9c785baa927d'; 
    const minIso = '2026-03-07T00:00:00Z';
    const maxIso = '2026-03-09T00:00:00Z';
    
    console.log("Testing Hydric Engine Transfusion Query...");
    try {
        const transRes = await pool.query(`
                SELECT 
                    s.actual_start_at as t_start, 
                    COALESCE(e.actual_end_at, s.actual_end_at, s.actual_start_at) as t_end, 
                    b.volume_administered_ml
                FROM administration_event_blood_bags b
                JOIN administration_events s ON b.administration_event_id = s.id AND s.action_type = 'started'
                LEFT JOIN administration_events e ON s.linked_event_id = e.linked_event_id AND e.action_type = 'ended' AND e.status != 'CANCELLED'
                JOIN prescription_events pe ON s.prescription_event_id = pe.id
                JOIN prescriptions p ON pe.prescription_id = p.id
                WHERE p.tenant_patient_id = $1
                  AND s.status != 'CANCELLED'
                  AND s.actual_start_at <= $3::timestamptz
                  AND COALESCE(e.actual_end_at, s.actual_end_at, s.actual_start_at) >= $2::timestamptz
        `, [tenantPatientId, minIso, maxIso]);
        console.table(transRes.rows);
    } catch (e) {
        console.error(e);
    }

    process.exit(0);
}
run();
