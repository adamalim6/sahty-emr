import { Pool } from 'pg';

async function run() {
    const pool = new Pool({
        user: 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        database: 'sahty_global'
    });
    
    try {
        const res = await pool.query(`
            SELECT pg_get_constraintdef(oid) 
            FROM pg_constraint 
            WHERE conname = 'lab_reference_rules_rule_type_check';
        `);
        console.log("Constraint definition:", res.rows[0]?.pg_get_constraintdef);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
