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
            SELECT id, analyte_label, unit_label, specimen_label 
            FROM public.lab_analyte_contexts
            WHERE actif IS NOT FALSE
            ORDER BY analyte_label ASC
        `);
        console.log("Found", res.rows.length, "analytes in sahty_global:");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
