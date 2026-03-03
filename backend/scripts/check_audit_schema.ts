import { getGlobalPool } from '../db/globalPg';

async function checkAuditSchema() {
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'audit_log';
        `);
        console.log(res.rows);
    } finally {
        client.release();
        await pool.end();
    }
}
checkAuditSchema().catch(console.error);
