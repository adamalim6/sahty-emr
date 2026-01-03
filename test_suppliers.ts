
import { pharmacyService } from './backend/services/pharmacyService.ts';

console.log("Testing PharmacyService.getSuppliers()...");
try {
    const suppliers = pharmacyService.getSuppliers();
    console.log(`Total Suppliers: ${suppliers.length}`);
    if (suppliers.length > 0) {
        console.log("First Supplier:", JSON.stringify(suppliers[0], null, 2));
        console.log("Last Supplier:", JSON.stringify(suppliers[suppliers.length - 1], null, 2));
        
        const globals = suppliers.filter(s => s.source === 'GLOBAL');
        console.log(`Global Suppliers Count: ${globals.length}`);
        
        const tenants = suppliers.filter(s => s.source === 'TENANT');
        console.log(`Tenant Suppliers Count: ${tenants.length}`);
    } else {
        console.log("No suppliers returned.");
    }
} catch (error) {
    console.error("Error calling getSuppliers:", error);
}
