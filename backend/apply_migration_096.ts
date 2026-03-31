import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

async function applyMigration() {
    console.log("Applying Phase 2: Dropping unit columns from sahty_global.public.lab_analytes...");
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    
    try {
        await globalPool.query(`
            ALTER TABLE public.lab_analytes 
            DROP COLUMN IF EXISTS default_unit_id CASCADE,
            DROP COLUMN IF EXISTS canonical_unit_id CASCADE,
            DROP COLUMN IF EXISTS decimal_precision CASCADE;
        `);
        console.log("  -> Global migration success.");
    } catch (e) {
        console.error("  -> Global migration failed", e);
    }
    
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    console.log(`\nFound ${tenantDatabases.length} tenant databases. Applying Phase 3...`);

    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await tPool.query('BEGIN');
            
            await tPool.query(`
                ALTER TABLE reference.lab_analytes
                DROP COLUMN IF EXISTS default_unit_id CASCADE,
                DROP COLUMN IF EXISTS canonical_unit_id CASCADE,
                DROP COLUMN IF EXISTS decimal_precision CASCADE;
            `);
            
            await tPool.query('COMMIT');
            console.log(`  -> Success for ${dbName}`);
        } catch (e) {
            await tPool.query('ROLLBACK');
            console.error(`  -> Failed for ${dbName}`, e);
        } finally {
            await tPool.end();
        }
    }
    
    console.log("\nMigration completed cross-cluster.");
}

applyMigration().catch(console.error);
