import { Pool } from 'pg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087';
    // Let's get today's data (or whatever is in the DB for this patient)
    const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: `tenant_${tenantId}` });
    try {
        const events = await pool.query(`
            SELECT parameter_code, bucket_start, value_numeric 
            FROM surveillance_values_events 
            WHERE tenant_patient_id = $1
            ORDER BY bucket_start ASC, parameter_code
        `, [patientId]);
        
        console.log("SURVEILLANCE_VALUES_EVENTS:");
        console.table(events.rows);

        const buckets = await pool.query(`
            SELECT bucket_start, values 
            FROM surveillance_hour_buckets 
            WHERE tenant_patient_id = $1
            ORDER BY bucket_start ASC
        `, [patientId]);
        
        console.log("SURVEILLANCE_HOUR_BUCKETS:");
        buckets.rows.forEach(r => console.log(r.bucket_start, JSON.stringify(r.values)));
    } catch(e: any) {
        console.error("ERROR:", e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
