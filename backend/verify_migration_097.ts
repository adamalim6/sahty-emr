import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

async function verifyMigration() {
    console.log("--- VERIFYING GLOBAL SCHEMA (PHASE 7) ---");
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    
    let res = await globalPool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'lab_analytes'");
    console.log("Global lab_analytes columns:", res.rows.map(r => r.column_name).join(", "));
    
    res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' LIMIT 1");
    const tenantDb = res.rows[0]?.datname;
    await globalPool.end();

    if (tenantDb) {
        console.log(`\n--- VERIFYING TENANT SCHEMA (${tenantDb}) ---`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${tenantDb}` });
        res = await tPool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'lab_analytes'");
        console.log("Tenant lab_analytes columns:", res.rows.map(r => r.column_name).join(", "));
        await tPool.end();
    }
}

verifyMigration().catch(console.error);
