
import { settingsService } from '../services/settingsService';
import { emrService } from '../services/emrService';
import { globalAdminService } from '../services/globalAdminService';
import { getTenantDB } from '../db/tenantDb';

async function verifyServices() {
    console.log("=== Verifying Services (SQL Refactor) ===");
    const tenantId = 'client_1768231080356';

    // 1. SettingsService
    try {
        console.log(`[Settings] Fetching users for ${tenantId}...`);
        const users = await settingsService.getUsers(tenantId);
        console.log(`[Settings] Users count: ${users.length}`);
        if(users.length === 0) console.error("!! No users found. Migration check needed.");

        const services = await settingsService.getServices(tenantId);
        console.log(`[Settings] Services count: ${services.length}`);
    } catch (e) {
        console.error("[Settings] FAILED:", e);
    }

    // 2. EmrService
    try {
        console.log(`[EMR] Fetching admissions for ${tenantId}...`);
        const admissions = await emrService.getAllAdmissions(tenantId);
        console.log(`[EMR] Admissions count: ${admissions.length}`);
        
        console.log(`[EMR] Fetching global patients...`);
        const patients = await emrService.getAllPatients();
        console.log(`[EMR] Patients count: ${patients.length}`);
    } catch (e) {
        console.error("[EMR] FAILED:", e);
    }

    // 3. GlobalAdminService
    try {
        console.log(`[GlobalAdmin] Verifying super admin...`);
        // We know 'admin' exists from previous migration log
        // Authenticate logic check (mock password won't work easily unless we use known hash or skip).
        // Let's just create a dummy admin or fetch by ID if possible? 
        // getAdminById was added. But wait, in migration we saw 'global_admin'.
        const admin = await globalAdminService.getAdminById('global_admin');
        if (admin) {
             console.log(`[GlobalAdmin] Found global admin: ${admin.username}`);
        } else {
             console.log(`[GlobalAdmin] 'global_admin' not found. Migration check needed.`);
        }

    } catch (e) {
        console.error("[GlobalAdmin] FAILED:", e);
    }
    
    console.log("=== Verification Complete ===");
}

verifyServices().catch(console.error);
