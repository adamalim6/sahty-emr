import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

async function applyMigration() {
    console.log("Applying Migration 098: LIMS rule_type swap to cached_value_type...");
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    console.log(`Found ${tenantDatabases.length} tenant databases. Applying schema changes...`);

    for (const dbName of tenantDatabases) {
        console.log(`\nApplying to ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await tPool.query('BEGIN');
            
            // 1. Add cached_value_type
            await tPool.query(`ALTER TABLE reference.lab_analyte_contexts ADD COLUMN IF NOT EXISTS cached_value_type TEXT;`);
            
            // 2. Backfill
            const updateRes = await tPool.query(`
                UPDATE reference.lab_analyte_contexts c
                SET cached_value_type = a.value_type
                FROM reference.lab_analytes a
                WHERE c.analyte_id = a.id AND c.cached_value_type IS NULL;
            `);
            console.log(`  -> Backfilled ${updateRes.rowCount} contexts.`);
            
            // 3. Verify
            const nullCheck = await tPool.query(`SELECT count(id) as c FROM reference.lab_analyte_contexts WHERE cached_value_type IS NULL`);
            if (parseInt(nullCheck.rows[0].c) > 0) {
                throw new Error("Backfill incomplete. Null cached_value_type found.");
            }
            
            // 4. Set NOT NULL
            await tPool.query(`ALTER TABLE reference.lab_analyte_contexts ALTER COLUMN cached_value_type SET NOT NULL;`);
            
            // 5. Drop constraint and rule_type column
            await tPool.query(`ALTER TABLE reference.lab_reference_rules DROP CONSTRAINT IF EXISTS lab_reference_rules_rule_type_check;`);
            await tPool.query(`ALTER TABLE reference.lab_reference_rules DROP COLUMN IF EXISTS rule_type CASCADE;`);
            
            await tPool.query('COMMIT');
            console.log(`  -> Success for ${dbName}`);
        } catch (e) {
            await tPool.query('ROLLBACK');
            console.error(`  -> Failed for ${dbName}`, e);
        } finally {
            await tPool.end();
        }
    }
    
    console.log("\nMigration 098 Complete!");
}

applyMigration().catch(console.error);
