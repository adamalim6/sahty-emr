import { Pool } from 'pg';

async function run() {
    console.log("Adding volume_administered_ml column...");

    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });

    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        
        for (const row of res.rows) {
            const dbName = row.datname;
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                await pool.query("BEGIN;");
                await pool.query(`
                    ALTER TABLE public.administration_event_blood_bags
                    ADD COLUMN IF NOT EXISTS volume_administered_ml NUMERIC NULL;
                `);
                await pool.query("COMMIT;");
                console.log(`✅ ${dbName}: volume_administered_ml applied successfully.`);
            } catch (err: any) {
                await pool.query("ROLLBACK;");
                console.error(`❌ ${dbName}: ${err.message}`);
            } finally {
                await pool.end();
            }
        }
    } catch (err: any) {
        console.error("Global Error:", err);
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}
run();
