import { Pool } from 'pg';

async function main() {
    const defaultPool = new Pool({
        user: 'sahty',
        host: 'localhost',
        database: 'postgres',
        password: 'sahty_dev_2026',
        port: 5432,
    });

    try {
        const res = await defaultPool.query(`SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'`);
        const tenants = res.rows.map(r => r.datname);
        
        for (const tenantDb of tenants) {
            console.log(`Applying constraint to ${tenantDb}...`);
            const pool = new Pool({
                user: 'sahty',
                host: 'localhost',
                database: tenantDb,
                password: 'sahty_dev_2026',
                port: 5432,
            });

            try {
                // First, clean up any hybrid rows if they exist by nullifying raw_analyte_label when context is present
                await pool.query(`UPDATE public.patient_lab_results SET raw_analyte_label = NULL WHERE lab_analyte_context_id IS NOT NULL AND raw_analyte_label IS NOT NULL`);
                
                // Also clean up any rows where both are null - which shouldn't exist, but just in case
                await pool.query(`DELETE FROM public.patient_lab_results WHERE lab_analyte_context_id IS NULL AND raw_analyte_label IS NULL`);

                await pool.query(`
                    ALTER TABLE public.patient_lab_results
                    DROP CONSTRAINT IF EXISTS chk_lab_result_mode;
                    
                    ALTER TABLE public.patient_lab_results
                    ADD CONSTRAINT chk_lab_result_mode
                    CHECK (
                      (lab_analyte_context_id IS NOT NULL AND raw_analyte_label IS NULL)
                      OR
                      (lab_analyte_context_id IS NULL AND raw_analyte_label IS NOT NULL)
                    );
                `);
                console.log(`Success for ${tenantDb}`);
            } catch (err) {
                console.error(`Failed on ${tenantDb}:`, err);
            } finally {
                await pool.end();
            }
        }
    } finally {
        await defaultPool.end();
    }
}

main().catch(console.error);
