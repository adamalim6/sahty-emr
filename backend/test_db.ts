import { Pool } from 'pg';

async function checkSchema() {
    console.log('--- Checking admin_events schema on tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895 ---');
    const pool = new Pool({
        user: 'admin',
        host: 'localhost',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895',
        password: 'admin',
        port: 5050,
    });
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'administration_events';
        `);
        console.table(res.rows);
    } catch(e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}
checkSchema();
