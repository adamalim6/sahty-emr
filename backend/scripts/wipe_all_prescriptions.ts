import { Pool } from 'pg';

async function run() {
    // Config: using standard dev credentials
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    
    try {
        // Find all tenant databases
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        console.log(`Found ${res.rows.length} tenant DBs`);
        
        for (const row of res.rows) {
            const dbName = row.datname;
            console.log(`Wiping prescriptions for ${dbName}...`);
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                // Ensure atomic operation
                await pool.query("BEGIN;");
                
                await pool.query("DELETE FROM administration_events;");
                await pool.query("DELETE FROM prescription_events;");
                await pool.query("DELETE FROM prescriptions;");
                
                await pool.query("COMMIT;");
                console.log(`✅ ${dbName}: wiped data successfully.`);
            } catch (err: any) {
                await pool.query("ROLLBACK;");
                console.error(`❌ ${dbName}: ${err.message}`);
                // Don't stop entirely on error
            } finally {
                await pool.end();
            }
        }
        console.log("Wipe completed for all tenants!");
    } catch (err: any) {
        console.error("Global Error:", err);
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}

run();
