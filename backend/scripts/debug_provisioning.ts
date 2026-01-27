
import { tenantProvisioningService } from '../services/tenantProvisioningService';
import path from 'path';
import fs from 'fs';

async function run() {
    console.log('🔍 Testing Tenant Provisioning Service...');
    
    // 1. Check Paths
    const schemaDir = path.join(__dirname, '../../migrations/pg/tenant');
    console.log(`[Debug] Calculated Schema Dir: ${schemaDir}`);
    
    if (fs.existsSync(schemaDir)) {
        console.log('✅ Schema Directory exists.');
        const files = fs.readdirSync(schemaDir);
        console.log('   Files:', files);
    } else {
        console.error('❌ Schema Directory NOT found!');
    }

    // 2. Try Provisioning a Test Tenant
    const testId = `test_tenant_${Date.now()}`;
    console.log(`\nAttempting to provision: ${testId}`);
    
    try {
        await tenantProvisioningService.createTenantDatabase(testId);
        console.log('✅ Provisioning successful!');
    } catch (e: any) {
        console.error('❌ Provisioning FAILED:', e);
    }
    
    process.exit(0);
}

run().catch(console.error);
