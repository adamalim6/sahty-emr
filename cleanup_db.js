
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'backend/data/pharmacy_db.json');

try {
    const rawData = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(rawData);

    let updatedCount = 0;

    data.catalog = data.catalog.map(product => {
        if (product.isSubdivisable) {
            // Check if units present
            const units = product.unitsPerPack || product.subdivisionUnits;

            if (!units || units <= 0) {
                console.log(`Fixing product ${product.name} (${product.id}): isSubdivisable=true but units=${units}`);
                // Default to 1 if missing/invalid, or should I turn off subdivisable?
                // User said "clean it up". Setting to 1 makes it "technically" subdivisable but effectively 1 unit.
                // Or maybe 10 is a better default for "packs"?
                // Let's set it to 1 to be safe and valid > 0.
                product.unitsPerPack = 1;
                updatedCount++;
            } else {
                // Normalize to unitsPerPack if using deprecated field
                if (!product.unitsPerPack && product.subdivisionUnits) {
                    product.unitsPerPack = product.subdivisionUnits;
                    updatedCount++;
                }
            }

            // Ensure we don't have lingering deprecated field issues? 
            // We'll keep deprecated field for now if it exists to avoid breaking frontend if it relies on it, 
            // BUT we should ensure unitsPerPack is the source of truth.
        }
        return product;
    });

    if (updatedCount > 0) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        console.log(`Updated ${updatedCount} products.`);
    } else {
        console.log("No invalid products found.");
    }

} catch (error) {
    console.error("Error processing DB:", error);
}
