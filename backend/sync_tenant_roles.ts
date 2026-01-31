import { globalQuery } from './db/globalPg';
import { tenantQuery } from './db/tenantPg';

/**
 * Sync tenant roles with global_roles - copy permissions from global to tenant
 */
(async () => {
    console.log('[Sync] Getting all clients...');
    const clients = await globalQuery("SELECT id FROM clients");
    console.log('Found', clients.length, 'tenants');
    
    console.log('\n[Sync] Getting global roles...');
    const globalRoles = await globalQuery("SELECT id, permissions FROM global_roles");
    console.log('Found', globalRoles.length, 'global roles');
    
    // For each tenant, update local roles with global permissions
    for (const client of clients) {
        const tenantId = client.id;
        try {
            for (const globalRole of globalRoles) {
                // Update the tenant role to match global permissions
                const result = await tenantQuery(tenantId,
                    `UPDATE roles SET permissions = $1 WHERE id = $2`,
                    [JSON.stringify(globalRole.permissions), globalRole.id]
                );
                // If the role doesn't exist in tenant, skip (no insert needed)
            }
            console.log(`[Sync] Updated roles for tenant: ${tenantId}`);
        } catch (e: any) {
            if (e.message?.includes('does not exist')) {
                console.log(`[Sync] No roles table in tenant: ${tenantId}, skipping`);
            } else {
                console.log(`[Sync] Error for tenant ${tenantId}:`, e.message);
            }
        }
    }
    
    console.log('\n[Sync] Done! All tenant roles should now match global_roles permissions.');
    
    // Verify by checking user 'inf' tenant again
    const tenantId = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';
    const tenantRole = await tenantQuery(tenantId, 
        "SELECT * FROM roles WHERE code = 'INFIRMIER'"
    );
    if (tenantRole.length > 0) {
        console.log('\n=== Verification - Tenant INFIRMIER role: ===');
        console.log('Permissions:', tenantRole[0].permissions);
        console.log('Has emr_returns?', tenantRole[0].permissions?.includes('emr_returns'));
    }
    
    process.exit(0);
})();
