import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";
const FORBIDDEN_CODES = "('NORMAL', 'ABNORMAL', 'ABNORMAL_LOW', 'ABNORMAL_HIGH', 'CAUTION', 'CAUTION_LOW', 'CAUTION_HIGH')";

async function applyMigration() {
    console.log("Applying Migration 099: Remove interpretation codes from canonical values...");
    
    // 1. Global DB Updates
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    try {
        await globalPool.query('BEGIN');
        
        console.log("Updating sahty_global...");
        const delRes = await globalPool.query(`DELETE FROM public.lab_canonical_allowed_values WHERE code IN ${FORBIDDEN_CODES}`);
        console.log(`  -> Deleted ${delRes.rowCount} forbidden codes from global.`);
        
        // Rename category -> value_domain safely
        const checkCol = await globalPool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='lab_canonical_allowed_values' AND column_name='category'`);
        if (checkCol.rowCount && checkCol.rowCount > 0) {
            await globalPool.query(`ALTER TABLE public.lab_canonical_allowed_values RENAME COLUMN category TO value_domain`);
            console.log("  -> Renamed category to value_domain in global.");
        }
        
        await globalPool.query(`ALTER TABLE public.lab_canonical_allowed_values ADD CONSTRAINT no_interpretation_values CHECK (code NOT IN ${FORBIDDEN_CODES})`);
        console.log("  -> Added CHECK constraint to global.");
        
        await globalPool.query('COMMIT');
    } catch (e) {
        await globalPool.query('ROLLBACK');
        console.error("Failed sahty_global update", e);
        process.exit(1);
    }
    
    // 2. Tenant DB Updates
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    console.log(`\nFound ${tenantDatabases.length} tenant databases. Applying to tenants...`);

    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await tPool.query('BEGIN');
            
            const delResTenant = await tPool.query(`DELETE FROM reference.lab_canonical_allowed_values WHERE code IN ${FORBIDDEN_CODES}`);
            console.log(`  -> Deleted ${delResTenant.rowCount} forbidden codes.`);
            
            const checkColTenant = await tPool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='reference' AND table_name='lab_canonical_allowed_values' AND column_name='category'`);
            if (checkColTenant.rowCount && checkColTenant.rowCount > 0) {
                await tPool.query(`ALTER TABLE reference.lab_canonical_allowed_values RENAME COLUMN category TO value_domain`);
            }
            
            // Drop constraint if it already exists from a previous run
            await tPool.query(`ALTER TABLE reference.lab_canonical_allowed_values Drop CONSTRAINT IF EXISTS no_interpretation_values`);
            await tPool.query(`ALTER TABLE reference.lab_canonical_allowed_values ADD CONSTRAINT no_interpretation_values CHECK (code NOT IN ${FORBIDDEN_CODES})`);
            
            await tPool.query('COMMIT');
            console.log(`  -> Success for ${dbName}`);
        } catch (e) {
            await tPool.query('ROLLBACK');
            console.error(`  -> Failed for ${dbName}`, e);
        } finally {
            await tPool.end();
        }
    }
    
    console.log("\nMigration 099 Complete!");
}

applyMigration().catch(console.error);
