import { authUserRepository } from './repositories/authUserRepository';
import { globalAdminService } from './services/globalAdminService';
import { authService } from './services/authService';
import jwt from 'jsonwebtoken';

async function test() {
    // We know 'medt' is on tenant 'ced91ced-fe46-45d1-8ead-b5d51bad5895'
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    
    // 1. Fetch user directly from repo
    const tenantUser = await authUserRepository.findByUsername('medt', tenantId);
    if (!tenantUser) {
        console.log('User not found');
        return process.exit(1);
    }
    console.log('--- tenantUser returned from AuthUserRepository ---');
    console.log({
        id: tenantUser.id,
        username: tenantUser.username,
        role_code: tenantUser.role_code,
        role_id: tenantUser.role_id
    });

    // 2. Fetch the role if needed 
    const { settingsService } = await import('./services/settingsService');
    const roles = await settingsService.getRoles(tenantId);
    let userRole = roles.find(r => r.id === tenantUser.role_id);
    
    if (!userRole && tenantUser.role_id) {
        userRole = await globalAdminService.getGlobalRole(tenantUser.role_id);
    }

    console.log('--- Resolved userRole ---');
    console.log(userRole ? { id: userRole.id, code: (userRole as any).code } : 'Not found');

    // 3. Generate Token
    // Simulate what authService.login does
    const token = authService.generateToken(tenantUser, 'tenant', {
        tenantId,
        modules: [],
        permissions: []
    });

    console.log('--- Final JWT Payload ---');
    console.log(jwt.decode(token));

    process.exit(0);
}

test();
