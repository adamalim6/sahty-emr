import { Pool } from 'pg';

const pool = new Pool({
    user: 'sahty_dev',
    host: 'localhost',
    database: 'sahty_tenant_adamalim6_sahty_emr',
    password: 'demo',
    port: 5432,
});

(async () => {
    try {
        const res = await pool.query('SELECT * FROM patient_addiction_history');
        console.log(`ROWS IN HISTORY: ${res.rowCount}`);
        if(res.rowCount > 0) {
            console.dir(res.rows[0], {depth: null});
        }
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
})();
