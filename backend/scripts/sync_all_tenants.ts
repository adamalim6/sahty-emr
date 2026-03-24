import { Pool } from 'pg';
import { syncTenantReference } from './referenceSync';

async function run() {
    const globalPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });
    const globalClient = await globalPool.connect();
    
    try {
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const datnames = res.rows;
        console.log(`Found ${datnames.length} tenant databases`);
        
        for (const row of datnames) {
            const dbName = row.datname;
            const tenantId = dbName.replace('tenant_', '');
            console.log(`\n\n--- Syncing Tenant Database: ${dbName} ---`);
            
            // Note: The syncTenantReference internally uses a pool if we just pass a client connected to that tenant's DB
            const tenantPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
            const tenantClient = await tenantPool.connect();
            
            try {
                await syncTenantReference(tenantClient, tenantId);
                console.log(`✅ Successfully synced ${dbName}`);
            } catch (err: any) {
                console.error(`❌ Failed to sync ${dbName}:`, err.message);
            } finally {
                tenantClient.release();
                await tenantPool.end();
            }
        }
    } catch(e) {
        console.error("Critical error:", e);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}

run();
