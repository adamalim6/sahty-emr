
import { settingsService } from './backend/services/settingsService';

const checkRoles = async () => {
    const tenantId = 'client_1768926673968';
    console.log(`Checking roles for tenant ${tenantId}...`);

    try {
        const roles = await settingsService.getRoles(tenantId);
        console.log("Roles retrieved successfully:");
        console.log(JSON.stringify(roles, null, 2));
    } catch (e) {
        console.error("FAILED to get roles:", e);
    }
};

checkRoles();
