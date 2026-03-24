const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: process.env.DB_USER || 'admin@sahty.dev',
        password: process.env.DB_PASSWORD || 'local@123',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: 'sahty_global'
    });
    
    try {
        await client.connect();
        const res = await client.query(`
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
        await client.end();
    }
}
run();
