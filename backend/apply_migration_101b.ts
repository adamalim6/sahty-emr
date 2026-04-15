import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

async function applyMigration() {
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    console.log(`Found ${tenantDatabases.length} tenant databases. Applying Phase 1b DB Foundations (lab_act_analyte_context)...`);

    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await tPool.query('BEGIN');
            
            await tPool.query(`
                CREATE TABLE IF NOT EXISTS lab_act_analyte_context (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    global_act_id UUID NOT NULL,
                    analyte_context_id UUID NOT NULL,
                    is_default BOOLEAN DEFAULT false,
                    actif BOOLEAN DEFAULT true,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                    CONSTRAINT uq_act_analyte_ctx UNIQUE (global_act_id, analyte_context_id)
                );

                CREATE INDEX IF NOT EXISTS idx_lab_act_ctx_act ON lab_act_analyte_context(global_act_id);
                CREATE INDEX IF NOT EXISTS idx_lab_act_ctx_ctx ON lab_act_analyte_context(analyte_context_id);
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
