import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'sahty',
  password: 'sahty_password',
  database: 'sahty_global'
});

async function run() {
    try {
        const res = await pool.query(`
            SELECT id, action_type, actual_start_at, actual_end_at, linked_event_id, volume_administered_ml 
            FROM tenant_ced91ced_fe46_45d1_8ead_b5d51bad5895.administration_events 
            ORDER BY created_at DESC 
            LIMIT 20;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
