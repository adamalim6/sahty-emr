import { tenantQuery } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function run() {
    try {
        const users = await tenantQuery(TENANT_ID, 'SELECT id, username, user_type FROM users LIMIT 5');
        console.log('Users:', users);
        
        const receptions = await tenantQuery(TENANT_ID, 'SELECT id, reception_reference, status, return_id FROM return_receptions WHERE status = \'OPEN\' LIMIT 5');
        console.log('Open Receptions:', receptions);
        
         if (process.send) process.send('done'); // Signal done if child process
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run().then(() => process.exit(0));
