import { Pool } from 'pg';

async function run() {
    console.log("Wiping test data for fresh testing...");

    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });

    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        
        for (const row of res.rows) {
            const dbName = row.datname;
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                await pool.query("BEGIN;");
                
                console.log(`Wiping data for ${dbName}...`);

                // Delete in order to respect foreign key constraints
                await pool.query('DELETE FROM public.administration_event_blood_bags;');
                await pool.query('DELETE FROM public.transfusion_checks;');
                await pool.query('DELETE FROM public.transfusion_reactions;');
                
                // administration_events might self-reference via linked_event_id, so cascade or disable triggers / run TRUNCATE
                await pool.query('TRUNCATE TABLE public.administration_events CASCADE;');
                await pool.query('TRUNCATE TABLE public.prescription_events CASCADE;');
                await pool.query('TRUNCATE TABLE public.transfusion_blood_bags CASCADE;');
                await pool.query('TRUNCATE TABLE public.prescriptions CASCADE;');

                await pool.query("COMMIT;");
                console.log(`✅ ${dbName}: test data wiped successfully.`);
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
