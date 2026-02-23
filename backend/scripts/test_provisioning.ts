import { tenantProvisioningService } from '../services/tenantProvisioningService';

async function testProvision() {
    const dummyId = '33333333-4444-5555-6666-777777777777';
    console.log('Testing provisioning for:', dummyId);
    try {
        await tenantProvisioningService.createTenantDatabase(dummyId);
        console.log('✅ Provisioning SUCCESS');
    } catch (e) {
        console.error('❌ Provisioning FAILED', e);
    }
    process.exit(0);
}

testProvision();
