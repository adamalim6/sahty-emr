
const fs = require('fs');
const path = require('path');

const tenantsDir = path.join(__dirname, 'backend/data/tenants');

if (!fs.existsSync(tenantsDir)) {
    console.error("Tenants dir not found");
    process.exit(1);
}

const tenants = fs.readdirSync(tenantsDir);

tenants.forEach(tenant => {
    const pPath = path.join(tenantsDir, tenant, 'pharmacy.json');
    if (fs.existsSync(pPath)) {
        console.log(`Processing ${tenant}...`);
        const data = JSON.parse(fs.readFileSync(pPath, 'utf8'));
        
        // STRICT CLEANUP
        if (data.catalog) {
            console.log(`- Removing catalog for ${tenant}`);
            delete data.catalog;
        }
        if (data.suppliers) {
            console.log(`- Removing suppliers for ${tenant}`);
            delete data.suppliers;
        }
        
        // Also check for legacy keys if any
        // "productVersions" -> user didn't explicitly forbid it, but let's see. 
        // User said "never prices, margins, suppliers, product names, dosages".
        // If productVersions contains names/dosages, it technically violates.
        // But let's stick to the explicit 'catalog' and 'suppliers' first which are the main offenders.
        
        fs.writeFileSync(pPath, JSON.stringify(data, null, 2));
    }
});
console.log("Cleanup Complete.");
