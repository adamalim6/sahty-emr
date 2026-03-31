import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

async function run() {
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map((row: any) => row.datname);
    await globalPool.end();

    console.log(`Found ${tenantDatabases.length} tenant databases. Applying schema update...`);

    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const pool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await pool.query('BEGIN');
            // First backfill any nulls
            const nulls = await pool.query(`SELECT id FROM public.lab_specimens WHERE barcode IS NULL`);
            for (let i = 0; i < nulls.rows.length; i++) {
                const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
                const random = Math.random().toString(36).substring(2, 8).toUpperCase();
                const barcode = `SHTY-${date}-${random}`;
                await pool.query(`UPDATE public.lab_specimens SET barcode = $1 WHERE id = $2`, [barcode, nulls.rows[i].id]);
            }

            // Create unique index
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_specimens_barcode_unique 
                ON public.lab_specimens(barcode);
            `);
            
            // Try to set NOT NULL if possible
            await pool.query(`ALTER TABLE public.lab_specimens ALTER COLUMN barcode SET NOT NULL`);
            await pool.query('COMMIT');
        } catch (e) {
            await pool.query('ROLLBACK');
            console.error(e);
        } finally {
            await pool.end();
        }
    }
    console.log('Done!');
}

run();
