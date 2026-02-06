import { tenantQuery } from './db/tenantPg';
import * as bcrypt from 'bcryptjs';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function run() {
    try {
        const hash = await bcrypt.hash('password123', 10);
        // Update user 'aze'
        await tenantQuery(TENANT_ID, 'UPDATE users SET password_hash = $1 WHERE username = \'aze\'', [hash]);
        console.log('Password reset for aze to password123');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
