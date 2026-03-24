import { Pool } from 'pg';
const pool = new Pool({
    user: 'sahty', host: 'localhost', database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895', password: 'sahty_dev_2026', port: 5432,
});
async function check() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%patient%' AND table_schema = 'public'");
        console.table(res.rows);
    } catch(e) { console.error(e); } finally { await pool.end(); }
}
check();
