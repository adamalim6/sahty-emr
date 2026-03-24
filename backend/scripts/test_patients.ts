import { Pool } from 'pg';
const pool = new Pool({ connectionString: "postgres://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895" });
async function test() {
    try {
        const res = await pool.query("SELECT * FROM public.tenant_patients LIMIT 1");
        console.log("FIELDS:", Object.keys(res.rows[0]));
    } catch(e) {
        console.error(e);
    }
}
test();
