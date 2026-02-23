import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        host: 'localhost', port: 5432, user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        await pool.query('ALTER TABLE coverage_members ALTER COLUMN tenant_patient_id DROP NOT NULL');
        console.log('SUCCESS: tenant_patient_id is now nullable on coverage_members');
    } catch(e: any) {
        console.error('FAILED:', e.message);
    } finally {
        await pool.end();
    }
}

main();
