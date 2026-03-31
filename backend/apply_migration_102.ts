import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";
const MIGRATION_PATH = path.join(__dirname, 'migrations', 'pg', 'tenant', '102_add_structured_columns_to_prescriptions.sql');

async function applyMigration() {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    console.log(`Found ${tenantDatabases.length} tenant databases. Applying Phase 1 Prescription Normalization...`);

    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await tPool.query('BEGIN');
            await tPool.query(sql);
            await tPool.query('COMMIT');
            console.log(`  -> Success for ${dbName}`);
        } catch (e: any) {
            await tPool.query('ROLLBACK');
            
            // Ignore duplicate column errors since this is an idempotent column addition script if we catch 42701 (duplicate column)
            if (e.code === '42701') {
                 console.log(`  -> Already applied (duplicate column) for ${dbName}`);
            } else {
                 console.error(`  -> Failed for ${dbName}`, e);
            }
        } finally {
            await tPool.end();
        }
    }
    
    console.log("\nMigration completed cross-cluster.");
}

applyMigration().catch(console.error);
