import { getGlobalPool } from '../db/globalPg';

async function checkSchema() {
    try {
        const pool = getGlobalPool();
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'observation_parameters';
        `);
        console.log("COLUMNS:");
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkSchema();
