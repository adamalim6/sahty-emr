import { getGlobalPool } from '../db/globalPg';

async function checkAudit() {
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'audit_log';
        `);
        console.log("Found audit_log table?", res.rows.length > 0);
        
        const funcRes = await client.query(`
            SELECT proname 
            FROM pg_proc 
            WHERE proname = 'fn_generic_audit';
        `);
        console.log("Found fn_generic_audit?", funcRes.rows.length > 0);
    } finally {
        client.release();
        await pool.end();
    }
}
checkAudit().catch(console.error);
