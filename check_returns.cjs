const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sahty_emr',
    password: 'admin',
    port: 5432,
});

async function checkReturns() {
    try {
        const res = await pool.query(`
            SELECT id, return_reference, status, tenant_id 
            FROM stock_returns 
            ORDER BY created_at DESC
        `);
        console.log("Total Returns Found:", res.rows.length);
        console.table(res.rows);
    } catch (err) {
        console.error("Error checking returns:", err);
    } finally {
        await pool.end();
    }
}

checkReturns();
