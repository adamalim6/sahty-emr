import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

async function applyMigration() {
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    console.log(`Found ${tenantDatabases.length} tenant databases. Applying schema update...`);

    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await tPool.query('BEGIN');
            
            // Drop current constraint on source_context tracking
            await tPool.query(`ALTER TABLE public.surveillance_values_events DROP CONSTRAINT IF EXISTS chk_surveillance_source_context;`);

            // Apply new wide constraint supporting algorithmic / automation payloads
            await tPool.query(`
                ALTER TABLE public.surveillance_values_events 
                ADD CONSTRAINT chk_surveillance_source_context 
                CHECK (source_context IN ('flowsheet', 'clinical_exam', 'hydric_engine', 'monitor', 'pump', 'integration', 'system'));
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
    
    console.log("Migration completed cross-cluster.");
}

applyMigration().catch(console.error);
