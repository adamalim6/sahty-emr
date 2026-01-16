
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
        
        let changed = false;
        // STRICT CLEANUP
        if (data.catalog) {
            console.log(`- Removing catalog for ${tenant}`);
            delete data.catalog;
            changed = true;
        }
        if (data.suppliers) {
            console.log(`- Removing suppliers for ${tenant}`);
            delete data.suppliers;
            changed = true;
        }
        
        if (changed) {
             fs.writeFileSync(pPath, JSON.stringify(data, null, 2));
        }
    }
});
console.log("Cleanup Complete.");
