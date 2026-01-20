
import { getTenantDB } from './backend/db/tenantDb';

const checkTenant = async () => {
    const tenantId = 'client_1768925628844'; // The one we fixed earlier
    console.log(`Checking DB for tenant ${tenantId}...`);
    
    // We need to mock the path or ensure running from root works. 
    // getTenantDB uses path relative to backend/data/tenants...
    
    try {
        const db = await getTenantDB(tenantId);
        
        // 1. List Tables
        await new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
                if (err) return reject(err);
                console.log("Tables:", rows.map((r: any) => r.name));
                resolve(true);
            });
        });

        // 2. Check service_units
        console.log("\n--- service_units ---");
        await new Promise((resolve, reject) => {
            db.all("SELECT * FROM service_units", [], (err, rows) => {
                if (err) {
                    console.error("Error querying service_units:", err.message);
                    return resolve(true); // Don't crash
                }
                console.log("Rows:", rows);
                resolve(true);
            });
        });

        // 3. Check locations
        console.log("\n--- locations ---");
         await new Promise((resolve, reject) => {
            db.all("SELECT * FROM locations", [], (err, rows) => {
                if (err) {
                    console.error("Error querying locations:", err.message);
                    return resolve(true);
                }
                console.log("Rows:", rows);
                resolve(true);
            });
        });

    } catch (e) {
        console.error("Connection failed:", e);
    }
};

checkTenant();
