
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'backend/data/pharmacy_db.json');

if (fs.existsSync(DB_FILE)) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    
    if (data.suppliers) {
        let patchedCount = 0;
        data.suppliers = data.suppliers.map(s => {
            // Assign existing orphans to client_1767102086031 (UMAN)
            if (!s.tenantId) {
                s.tenantId = 'client_1767102086031';
                patchedCount++;
            }
            return s;
        });
        
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        console.log(`Patched ${patchedCount} suppliers with tenantId.`);
    }
}
