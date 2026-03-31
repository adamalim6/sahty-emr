import { getTenantPool } from './db/tenantPg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const pool = getTenantPool('ced91ced_fe46_45d1_8ead_b5d51bad5895');
    const res = await pool.query(`
        SELECT p.id, p.prescription_type, p.status, pe.id as ev_id, pe.scheduled_at 
        FROM prescriptions p 
        LEFT JOIN prescription_events pe ON pe.prescription_id = p.id
        ORDER BY p.created_at DESC LIMIT 15
    `);
    console.table(res.rows);
    process.exit(0);
}

run();
