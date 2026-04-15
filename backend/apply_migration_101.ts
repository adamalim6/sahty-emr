import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

async function applyMigration() {
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    console.log(`Found ${tenantDatabases.length} tenant databases. Applying Phase 1 DB Foundations (lab_act_taxonomy)...`);

    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await tPool.query('BEGIN');
            
            await tPool.query(`
                CREATE TABLE IF NOT EXISTS lab_act_taxonomy (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    act_id UUID NOT NULL,
                    sous_famille_id UUID NOT NULL,
                    section_id UUID NOT NULL,
                    sub_section_id UUID,
                    aktif BOOLEAN DEFAULT true, -- using actif, wait changing to actif
                    actif BOOLEAN DEFAULT true,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                    CONSTRAINT uq_act_id UNIQUE (act_id)
                );

                -- We drop "aktif" just in case it registered due to my typo line in previous runs
                ALTER TABLE lab_act_taxonomy DROP COLUMN IF EXISTS aktif;

                CREATE INDEX IF NOT EXISTS idx_lab_act_tax_act ON lab_act_taxonomy(act_id);
                CREATE INDEX IF NOT EXISTS idx_lab_act_tax_sf ON lab_act_taxonomy(sous_famille_id);
                CREATE INDEX IF NOT EXISTS idx_lab_act_tax_sec ON lab_act_taxonomy(section_id);
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
