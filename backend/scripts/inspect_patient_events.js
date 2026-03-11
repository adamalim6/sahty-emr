const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://sahty:sahty_password@localhost:5432/sahty_global'
});

async function run() {
    try {
        const res = await pool.query(`
            SELECT 
                ae.id,
                ae.action_type,
                ae.actual_start_at,
                ae.actual_end_at,
                ae.occurred_at,
                ae.linked_event_id,
                ae.volume_administered_ml,
                pe.requires_fluid_info,
                p.prescription_type
            FROM tenant_ced91ced_fe46_45d1_8ead_b5d51bad5895.administration_events ae
            JOIN tenant_ced91ced_fe46_45d1_8ead_b5d51bad5895.prescription_events pe ON ae.prescription_event_id = pe.id
            JOIN tenant_ced91ced_fe46_45d1_8ead_b5d51bad5895.prescriptions p ON pe.prescription_id = p.id
            WHERE p.tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d'
            ORDER BY ae.created_at DESC
            LIMIT 10;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}
run();
