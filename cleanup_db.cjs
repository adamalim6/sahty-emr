
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'backend/data/pharmacy_db.json');

try {
    const rawData = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(rawData);

    let updatedCount = 0;

    data.catalog = data.catalog.map(product => {
        if (product.isSubdivisable) {
            const units = product.unitsPerPack || product.subdivisionUnits;

            if (!units || units <= 0) { // Check for undefined, null, or <= 0
                console.log(`Fixing product ${product.name} (${product.id}): isSubdivisable=true but units=${units}`);
                // Fix: Set to 1
                product.unitsPerPack = 1;
                // Also set subdivisionUnits for frontend compatibility if it's missing or invalid
                if (!product.subdivisionUnits || product.subdivisionUnits <= 0) {
                    product.subdivisionUnits = 1;
                }
                updatedCount++;
            } else {
                // Sync fields if one is missing but other is valid
                if (!product.unitsPerPack && product.subdivisionUnits) {
                    product.unitsPerPack = product.subdivisionUnits;
                    updatedCount++;
                } else if (product.unitsPerPack && !product.subdivisionUnits) {
                    product.subdivisionUnits = product.unitsPerPack;
                    updatedCount++;
                }
            }
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
