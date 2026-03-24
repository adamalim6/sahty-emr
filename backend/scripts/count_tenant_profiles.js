const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    
    try {
        await client.connect();
        const r1 = await client.query('SELECT COUNT(*) FROM reference.lab_canonical_allowed_values');
        const r2 = await client.query('SELECT COUNT(*) FROM reference.lab_reference_profiles');
        const r3 = await client.query('SELECT COUNT(*) FROM reference.lab_reference_rules');
        const r4 = await client.query('SELECT COUNT(*) FROM reference.lab_act_contexts');
        
        console.log("Tenant Data:");
        console.log("Canonical values:", r1.rows[0].count);
        console.log("Profiles:", r2.rows[0].count);
        console.log("Rules:", r3.rows[0].count);
        console.log("Act Contexts:", r4.rows[0].count);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
