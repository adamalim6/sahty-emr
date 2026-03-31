import { Pool } from 'pg';

async function test() {
    const p = new Pool({connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'});
    const client = await p.connect();
    console.log("Connected to tenant_ced91ced");
    try {
        await client.query('BEGIN');
        const res = await client.query(`
            INSERT INTO surveillance_values_events (
                tenant_id, tenant_patient_id, parameter_id, parameter_code, 
                bucket_start, value_numeric, value_text, value_boolean, 
                recorded_by, recorded_at, recorded_by_first_name, recorded_by_last_name,
                source_context, observed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, 'flowsheet', $5) RETURNING id
        `, [
            'ced91ced-fe46-45d1-8ead-b5d51bad5895', 
            'a720c03a-f492-46e6-ae4d-14f639392087', 
            '995df62d-4083-4f19-8136-6d0a730b181b', 
            'APPORTS_HYD_CR_MAN', 
            new Date().toISOString(), 
            250, null, null, 
            'a720c03a-f492-46e6-ae4d-14f639392087', 
            'Test', 'User'
        ]);
        console.log("INSERT SUCCESS! ID:", res.rows[0].id);
        await client.query('COMMIT');
    } catch(e: any) {
        await client.query('ROLLBACK');
        console.log("SQL INSERT CRASHED!", e.message, e.code, e.detail);
    } finally {
        client.release();
        await p.end();
    }
}
test().catch(e => console.log("Outer catch:", e));
