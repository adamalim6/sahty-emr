import { getGlobalPool } from '../db/globalPg';

async function checkDbg() {
    const pool = getGlobalPool();
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT table_name, action, changed_by, COUNT(*) as c FROM public.audit_log GROUP BY 1,2,3`);
        console.log("Audit Logs grouped:", res.rows);
    } finally {
        client.release();
        await pool.end();
    }
}
checkDbg();
