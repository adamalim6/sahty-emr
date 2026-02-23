import { getGlobalPool } from './db/globalPg';

async function run() {
    const pool = getGlobalPool();
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'observation_flowsheets' OR tablename = 'observation_groups';
        `);
        console.log("Global Indexes:", res.rows);
        
        const resFlows = await client.query(`SELECT id, code, label, sort_order FROM observation_flowsheets`);
        console.log("Global Flowsheets:", resFlows.rows);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.release();
        process.exit(0);
    }
}
run();
