import { tenantQuery, closeAllTenantPools } from '../db/tenantPg';
import { closeGlobalPool } from '../db/globalPg';

const tenantId = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function run() {
    try {
        // First, find a valid user to use as fallback
        console.log('1. Finding fallback user...');
        const users = await tenantQuery(tenantId, `SELECT id FROM users LIMIT 1`);
        const fallbackUserId = users[0]?.id;
        console.log(`   Fallback user: ${fallbackUserId}`);

        // Fix requested_by with non-UUID values (like 'inf')
        console.log('2. Fixing stock_demands.requested_by non-UUID values...');
        // First try to look up user by username
        await tenantQuery(tenantId, `
            UPDATE stock_demands sd
            SET requested_by = (SELECT id::text FROM users WHERE username = sd.requested_by LIMIT 1)
            WHERE requested_by IS NOT NULL 
              AND requested_by !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              AND EXISTS (SELECT 1 FROM users WHERE username = sd.requested_by)
        `);
        // Set remaining non-UUID values to NULL
        await tenantQuery(tenantId, `
            UPDATE stock_demands 
            SET requested_by = NULL
            WHERE requested_by IS NOT NULL 
              AND requested_by !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        `);

        console.log('3. stock_demands.requested_by -> UUID');
        await tenantQuery(tenantId, `ALTER TABLE stock_demands ALTER COLUMN requested_by TYPE UUID USING NULLIF(requested_by, '')::uuid`);
        
        console.log('Done!');
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await closeAllTenantPools();
        await closeGlobalPool();
        process.exit(0);
    }
}
run();
