import { getGlobalPool } from '../db/globalPg';

async function checkSchemas() {
    const pool = getGlobalPool();
    const result = await pool.query(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE '%observation%' OR table_name = 'units' OR table_name LIKE '%group%'
    `);
    console.log(result.rows);
    await pool.end();
}

checkSchemas();
