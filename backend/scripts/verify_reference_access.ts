
import { pharmacyService } from '../services/pharmacyService';
import { getTenantPool } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';

async function verify() {
    console.log('--- Verifying Reference Data Access ---');
    
    // 1. Get a valid tenant
    const clients = await globalQuery('SELECT id FROM clients LIMIT 1');
    if (clients.length === 0) {
        console.error('No tenants found.');
        return;
    }
    const tenantId = clients[0].id;
    console.log(`Using Tenant: ${tenantId}`);

    // Ensure connection
    const pool = getTenantPool(tenantId);
    
    try {
        // 2. Test Catalog (Products)
        console.log('\n--- Testing getCatalog ---');
        const products = await pharmacyService.getCatalog(tenantId);
        console.log(`Retrieved ${products.length} products.`);
        if (products.length > 0) {
            console.log('Sample Product:', JSON.stringify(products[0], null, 2));
            // Check if it has expected fields
            if (!products[0].id || !products[0].name) {
                console.error('❌ Product missing critical fields.');
            } else {
                console.log('✅ Product structure OK.');
            }
            
            // Check DCI enrichment
            if (products[0].dciComposition) {
                console.log('DCI Composition:', JSON.stringify(products[0].dciComposition));
            }
        } else {
            console.warn('⚠️ No products found. Verify migration populated data.');
        }

        // 3. Test Suppliers
        console.log('\n--- Testing getSuppliers ---');
        const suppliers = await pharmacyService.getSuppliers(tenantId);
        console.log(`Retrieved ${suppliers.length} suppliers.`);
        if (suppliers.length > 0) {
            console.log('Sample Supplier:', JSON.stringify(suppliers[0], null, 2));
             if (!suppliers[0].id || !suppliers[0].name) {
                console.error('❌ Supplier missing critical fields.');
            } else {
                console.log('✅ Supplier structure OK.');
            }
        } else {
             console.warn('⚠️ No suppliers found.');
        }

        // 4. Test Actes
        console.log('\n--- Testing getGlobalActesPaginated ---');
        // Use the method we just added
        // Note: verify_reference_access.ts imports pharmacyService, but pharmacyService doesn't expose Actes directly?
        // Wait, ReferenceDataService is what we need. 
        // Let's assume we can import ReferenceDataService or add a method to verify it.
        // Actually, let's just use the service directly.
        const { referenceDataService } = require('../services/referenceDataService');

        const actes = await referenceDataService.getGlobalActesPaginated(tenantId, 1, 5, '');
        console.log(`Retrieved ${actes.total} actes.`);
        if (actes.data.length > 0) {
            console.log('Sample Acte:', JSON.stringify(actes.data[0], null, 2));
             if (!actes.data[0].code || !actes.data[0].label) {
                console.error('❌ Acte missing critical fields.');
            } else {
                console.log('✅ Acte structure OK.');
            }
        } else {
             console.warn('⚠️ No actes found.');
        }

    } catch (e: any) {
        console.error('❌ Verification FAILED:', e);
    } finally {
        process.exit(0);
    }
}

verify().catch(console.error);
