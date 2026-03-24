const { Pool } = require('pg');
const fs = require('fs');

const GLOBAL_MIGRATION_PATH = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/global/073_lab_act_spec_volume_unit_global.sql';
const TENANT_MIGRATION_PATH = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/tenant/090_lab_act_spec_volume_unit_tenant.sql';

const globalPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

async function run() {
    const globalClient = await globalPool.connect();
    
    try {
        // 1. Run Global
        console.log(`[EXEC] Running Global Migration 073...`);
        const globalSql = fs.readFileSync(GLOBAL_MIGRATION_PATH, 'utf-8');
        await globalClient.query(globalSql);
        console.log(`✅ sahty_global successfully upgraded.`);

        // 2. Discover Tenants
        const tRes = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const tenants = tRes.rows.map(r => r.datname);
        
        console.log(`\n[EXEC] Discovered ${tenants.length} target tenant environments...`);
        const tenantSql = fs.readFileSync(TENANT_MIGRATION_PATH, 'utf-8');

        // 3. Loop Tenants
        for (const t of tenants) {
            const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${t}` });
            const tClient = await tPool.connect();
            try {
                await tClient.query(tenantSql);
                console.log(`✅ ${t} successfully upgraded.`);
            } catch (err) {
                console.error(`❌ Migration failed on ${t}:`, err.message);
            } finally {
                tClient.release();
                await tPool.end();
            }
        }
        console.log('\n[SUCCESS] Structural deployment completed seamlessly.');
        
    } catch (e) {
        console.error('[FATAL]', e);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}

run();
