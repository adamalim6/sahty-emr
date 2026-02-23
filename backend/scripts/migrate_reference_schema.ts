
import { getActiveTenantIds, getTenantPool } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';
import { syncTenantReference } from './referenceSync';

async function migrateAllTenants() {
    console.log('Starting Reference Schema Migration for ALL tenants...');

    // 1. Get all tenants from Global DB (source of truth for existence)
    const tenants = await globalQuery('SELECT id FROM tenants');
    
    console.log(`Found ${tenants.length} tenants to process.`);

    for (const tenant of tenants) {
        const tenantId = tenant.id;
        try {
            console.log(`Processing Tenant ${tenantId}...`);
            const pool = getTenantPool(tenantId);
            const client = await pool.connect();
            try {
                // Use a transaction for safety
                await client.query('BEGIN');
                await syncTenantReference(client, tenantId);
                await client.query('COMMIT');
                console.log(`✅ Tenant ${tenantId} migrated successfully.`);
            } catch (e) {
                await client.query('ROLLBACK');
                console.error(`❌ Tenant ${tenantId} failed migration:`, e);
                // Continue to next tenant, don't stop everything
            } finally {
                client.release();
            }
        } catch (err: any) {
            console.error(`❌ Tenant ${tenantId} connection failed:`, err.message);
        }
    }

    console.log('Migration Complete.');
    process.exit(0);
}

migrateAllTenants().catch(err => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
});
