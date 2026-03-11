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
        await pool.query(`
            SELECT COALESCE(linked_event_id, id::text) FROM tenant_ced91ced_fe46_45d1_8ead_b5d51bad5895.administration_events LIMIT 1;
        `);
        console.log("Success with coercion.");
    } catch (e: any) {
        console.error("Error with coercion:", e.message);
    } finally {
        await pool.end();
    }
}
run();
