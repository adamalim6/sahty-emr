
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'backend/data/pharmacy_db.json');

if (!fs.existsSync(DB_PATH)) {
    console.error('DB file not found at:', DB_PATH);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const packs = data.serializedPacks || [];

console.log(`Processing ${packs.length} packs...`);

const ids = new Set();
let fixedCount = 0;

packs.forEach((pack, index) => {
    // Check for duplicate or if we just want to re-generate all to be safe?
    // Let's re-generate ALL to ensure consistency and avoid conflicts.
    // Or just generating for duplicates?
    // Safer to re-generate all with a stable unique pattern.

    // Pattern: pack-{timestamp}-{index}
    // We use a high-res timestamp + index to guarantee uniqueness
    const newId = `pack-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;

    // Only update if duplicate? No, update all to be safe.
    // But we need to update references? 
    // Dispensations might reference packId.
    const oldId = pack.id;
    pack.id = newId;

    // Update references in dispensations
    if (data.dispensations) {
        data.dispensations.forEach(d => {
            if (d.serializedPackId === oldId) {
                d.serializedPackId = newId;
            }
        });
    }

    ids.add(newId);
    fixedCount++;
});

// Also fix the Service logic to prevent future collisions? 
// That requires editing TS file. We will do that separately.

fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

console.log(`Fixed ids for ${fixedCount} packs.`);
console.log('Done.');
