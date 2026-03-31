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
            console.log(`Dropping constraint for ${tenantDb}...`);
            const pool = new Pool({
                user: 'sahty',
                host: 'localhost',
                database: tenantDb,
                password: 'sahty_dev_2026',
                port: 5432,
            });

            try {
                await pool.query(`ALTER TABLE public.patient_lab_results DROP CONSTRAINT IF EXISTS chk_lab_result_mode;`);
                
                // Add a new safe constraint if user just wanted to ensure free rows have labels:
                await pool.query(`
                    ALTER TABLE public.patient_lab_results
                    ADD CONSTRAINT chk_lab_result_mode
                    CHECK (
                      (lab_analyte_context_id IS NULL AND raw_analyte_label IS NOT NULL) OR (lab_analyte_context_id IS NOT NULL)
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
