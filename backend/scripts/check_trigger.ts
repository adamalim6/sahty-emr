import { getGlobalPool } from '../db/globalPg';

async function checkT() {
    const globalPool = getGlobalPool();
    const globalClient = await globalPool.connect();
    
    try {
        const res = await globalClient.query(`SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'audit_log'`);
        console.log(res.rows);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}
checkT();
