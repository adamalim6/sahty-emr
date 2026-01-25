
const { PharmacyService } = require('../services/pharmacyService');
const { getTenantDB } = require('../db/tenantDb');

async function debugSuppliers() {
    const tenantId = 'client_1768926673968'; // Specific tenant from migration script
    const pharmacyService = PharmacyService.getInstance();

    console.log("--- DEBUGGING SUPPLIERS ---");

    // 1. Fetch Suppliers
    const suppliers = await pharmacyService.getSuppliers(tenantId);
    console.log(`> All Suppliers Count: ${suppliers.length}`);
    suppliers.forEach((s: any) => console.log(`  - [${s.id}] ${s.name} (${s.source})`));

    // 2. Fetch Catalog (Simulating what Frontend gets)
    // Note: getCatalog API likely calls pharmacyService.getStock or uses a custom query.
    // Let's check pharmacyService.getProductConfig or similar.
    // Actually, backend controller for /catalog calls:
    // const products = await pharmacyService.getLocations... No.
    // We need to simulate fetching products. Assuming we can iterate IDs or just fetch from DB.
    
    // Let's just fetch ALL products directly to see their raw state
    const db = await getTenantDB(tenantId);
    const productRows = await new Promise<any[]>((resolve, reject) => {
        db.all("SELECT * FROM products", [], (err: any, rows: any) => err ? reject(err) : resolve(rows));
    });
    console.log(`> Products in DB: ${productRows.length}`);

    let productsWithSuppliers = 0;
    
    for (const p of productRows) {
        // Fetch Config with Suppliers
        try {
            const config = await pharmacyService.getProductConfig(tenantId, p.id);
            const hasSuppliers = config.suppliers && config.suppliers.length > 0;
            if (hasSuppliers) {
                productsWithSuppliers++;
                console.log(`  - Product [${p.id}] has ${config.suppliers.length} suppliers:`);
                config.suppliers.forEach((s: any) => {
                    // Check match
                    const match = suppliers.find((sup: any) => sup.id === s.id);
                    console.log(`    * ID: ${s.id} | Name: ${s.name} | Matched in List? ${!!match}`);
                });
            } else {
                // console.log(`  - Product [${p.id}] has NO suppliers.`);
            }
        } catch (e) {
            console.error(`  ! Error fetching config for ${p.id}:`, (e as any).message);
        }
    }

    console.log(`> Summary: ${productsWithSuppliers} / ${productRows.length} products have suppliers.`);
}

debugSuppliers().catch(console.error);
