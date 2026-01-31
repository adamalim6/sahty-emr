import { globalQuery } from './db/globalPg';
import { tenantQuery } from './db/tenantPg';

(async () => {
    const tenantId = '36dff8fa-4729-4c10-a0bf-712be63cc9b2'; // Tenant where user 'inf' exists
    
    console.log('[Check] Looking for roles table in tenant DB...');
    try {
        const tenantRoles = await tenantQuery(tenantId, 
            "SELECT id, code, name, permissions FROM roles"
        );
        console.log('Tenant roles found:', tenantRoles.length);
        tenantRoles.forEach((r: any) => {
            if (r.code === 'INFIRMIER' || r.name?.toLowerCase().includes('infirm')) {
                console.log('\n=== TENANT ROLE (potential override): ===');
                console.log('ID:', r.id);
                console.log('Code:', r.code);
                console.log('Name:', r.name);
                console.log('Permissions:', r.permissions);
                console.log('Has emr_returns?', r.permissions?.includes('emr_returns'));
            }
        });
    } catch (e: any) {
        console.log('No roles table in tenant or error:', e.message);
    }
    
    // Also check what permissions are returned for user 'inf' by the exact same lookup path
    console.log('\n[Check] Simulating /me lookup path...');
    const user = (await tenantQuery(tenantId, "SELECT * FROM users WHERE username = 'inf'"))[0];
    console.log('User role_id:', user.role_id);
    
    // Check tenant roles first (as /me does)
    try {
        const tenantRole = await tenantQuery(tenantId, 
            "SELECT * FROM roles WHERE id = $1", [user.role_id]
        );
        if (tenantRole.length > 0) {
            console.log('\n=== Found in TENANT roles table (this overrides global!): ===');
            console.log('Role:', tenantRole[0].code);
            console.log('Permissions:', tenantRole[0].permissions);
        } else {
            console.log('Not found in tenant roles table');
        }
    } catch (e: any) {
        console.log('Tenant roles query failed:', e.message);
    }
    
    // Then check global
    const globalRole = await globalQuery(
        "SELECT * FROM global_roles WHERE id = $1", [user.role_id]
    );
    if (globalRole.length > 0) {
        console.log('\n=== Found in GLOBAL roles table: ===');
        console.log('Role:', globalRole[0].code);
        console.log('Permissions:', globalRole[0].permissions);
        console.log('Has emr_returns?', globalRole[0].permissions?.includes('emr_returns'));
    }
    
    process.exit(0);
})();
