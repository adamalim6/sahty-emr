const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895' });

async function clearData() {
    try {
        await pool.query('BEGIN');
        
        await pool.query('DELETE FROM administration_events;');
        await pool.query('DELETE FROM prescription_events;');
        await pool.query('DELETE FROM prescriptions;');
        
        await pool.query('COMMIT');
        console.log('Cleared all prescriptions, prescription_events, and administration_events successfully.');
    } catch(err) {
        await pool.query('ROLLBACK');
        console.error(err);
    } finally {
        process.exit(0);
    }
}
clearData();
