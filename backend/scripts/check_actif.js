const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: process.env.DB_USER || 'admin@sahty.dev',
        password: process.env.DB_PASSWORD || 'local@123',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    await client.connect();
    const res1 = await client.query('SELECT actif, COUNT(*) FROM reference.lab_analyte_contexts GROUP BY actif');
    console.log("lab_analyte_contexts actif counts:", res1.rows);
    const res2 = await client.query('SELECT COUNT(*) FROM reference.global_actes WHERE sous_famille = $1', ['BIOLOGIE']);
    console.log("global_actes BIOLOGIE count:", res2.rows);
    await client.end();
}
run().catch(console.error);
