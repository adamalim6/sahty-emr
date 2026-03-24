import { Pool } from 'pg';
const pool = new Pool({
    user: 'sahty', host: 'localhost', database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895', password: 'sahty_dev_2026', port: 5432,
});
async function check() {
    try {
        const res = await pool.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'patient_lab_results'");
        console.table(res.rows);
    } catch(e) { console.error(e); } finally { await pool.end(); }
}
check();
