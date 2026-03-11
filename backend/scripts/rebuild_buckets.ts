import { Pool } from 'pg';

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        for (const row of res.rows) {
            const dbName = row.datname;
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                await pool.query("BEGIN;");
                await pool.query("DELETE FROM surveillance_hour_buckets");
                
                await pool.query(`
                    INSERT INTO surveillance_hour_buckets (id, tenant_id, tenant_patient_id, bucket_start, values)
                    SELECT gen_random_uuid(), tenant_id, tenant_patient_id, bucket_start,
                           jsonb_object_agg(parameter_code, 
                               COALESCE(to_jsonb(value_numeric), to_jsonb(value_text), to_jsonb(value_boolean))
                           )
                    FROM surveillance_values_events
                    GROUP BY tenant_id, tenant_patient_id, bucket_start
                `);
                await pool.query("COMMIT;");
                console.log(`✅ ${dbName}: Cache reconstruction completed!`);
            } catch (err: any) {
                await pool.query("ROLLBACK;");
                console.error(`❌ ${dbName}: ${err.message}`);
            } finally {
                await pool.end();
            }
        }
    } catch (err: any) {
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}
run();
