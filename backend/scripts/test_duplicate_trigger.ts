import { Pool } from 'pg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const patientId = '2a96aac3-9cdb-4912-bb55-2bb3fec17805';
    const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: `tenant_${tenantId}` });
    try {
        await pool.query('BEGIN');
        
        console.log("Dropping duplicate trigger trg_surv_event_bucket...");
        await pool.query('DROP TRIGGER IF EXISTS trg_surv_event_bucket ON surveillance_values_events');
        
        console.log("Testing insert...");
        await pool.query(`
            INSERT INTO surveillance_values_events (
                tenant_id, tenant_patient_id, parameter_id, parameter_code, 
                bucket_start, value_numeric, recorded_by, recorded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [tenantId, patientId, '980bd724-4c82-45c3-b2ef-8d8b775e550a', 'HYDRIC_INPUT', new Date().toISOString(), 999, 'a04e92f1-4705-47c8-b4df-fd37ef3cb6a0']);
        
        console.log("Insert successful!");
        await pool.query('ROLLBACK');
    } catch (e: any) {
        console.error("Error:", e.message);
        await pool.query('ROLLBACK');
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
