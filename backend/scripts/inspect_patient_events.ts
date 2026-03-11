import { getTenantPool } from '../db/tenantDb';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
        const db = await pool.connect();
        const res = await db.query(`
            SELECT 
                ae.id,
                ae.action_type,
                ae.actual_start_at,
                ae.actual_end_at,
                ae.linked_event_id,
                ae.volume_administered_ml,
                pe.requires_fluid_info,
                p.prescription_type
            FROM administration_events ae
            JOIN prescription_events pe ON ae.prescription_event_id = pe.id
            JOIN prescriptions p ON pe.prescription_id = p.id
            WHERE p.tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d'
            ORDER BY ae.created_at DESC
            LIMIT 10;
        `);
        db.release();
        console.table(res.rows);
    } catch (e) {
        console.error(e.message);
    }
}
run();
