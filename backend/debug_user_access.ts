
import { getTenantPool } from './db/tenantPg';

async function debugUser() {
    const tenantId = '36dff8fa-4729-4c10-a0bf-712be63cc9b2'; 
    const pool = getTenantPool(tenantId);

    console.log('\n--- Checking User "inf" ---');
    const res = await pool.query('SELECT username, user_type, role_id, service_ids FROM users WHERE username = $1', ['inf']);
    console.table(res.rows);

    process.exit(0);
}

debugUser().catch(console.error);
