
const { PharmacyService } = require('./services/pharmacyService');
const { getTenantDB } = require('./db/tenantDb');

async function debugSuppliers() {
    const tenantId = 'client_1768926673968'; 

    console.log("--- DEBUGGING SUPPLIERS (JS) ---");

    try {
        const pharmacyService = PharmacyService.getInstance();
        const suppliers = await pharmacyService.getSuppliers(tenantId);
        console.log(`> All Suppliers Count: ${suppliers.length}`);
        suppliers.forEach(s => console.log(`  - [${s.id}] ${s.name} (${s.source})`));

        const db = await getTenantDB(tenantId);
        const productRows = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM products", [], (err, rows) => err ? reject(err) : resolve(rows));
        });
        console.log(`> Products in DB: ${productRows.length}`);

        let productsWithSuppliers = 0;
        
        for (const p of productRows) {
            try {
                const config = await pharmacyService.getProductConfig(tenantId, p.id);
                if (config.suppliers && config.suppliers.length > 0) {
                    productsWithSuppliers++;
                    // console.log(`  - Product [${p.id}] has ${config.suppliers.length} suppliers.`);
                }
            } catch (e) {
                // console.error(`  ! Error fetching config for ${p.id}:`, e.message);
            }
        }
        console.log(`> Summary: ${productsWithSuppliers} / ${productRows.length} products have suppliers.`);
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
}

debugSuppliers();
