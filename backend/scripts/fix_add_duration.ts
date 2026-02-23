import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        host: 'localhost', port: 5432, user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        await pool.query('ALTER TABLE prescription_events ADD COLUMN IF NOT EXISTS duration INTEGER');
        console.log('SUCCESS: duration column added to prescription_events');
    } catch(e: any) {
        console.error('FAILED:', e.message);
    } finally {
        await pool.end();
    }
}

main();
