import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        host: 'localhost', port: 5432, user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        await pool.query('DELETE FROM administration_events');
        await pool.query('DELETE FROM prescription_events');
        await pool.query('DELETE FROM prescriptions');
        console.log('All prescription data dropped');
    } catch(e: any) {
        console.error('FAILED:', e.message);
    } finally {
        await pool.end();
    }
}

main();
