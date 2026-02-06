
import { tenantQuery, tenantTransaction } from '../../db/tenantPg';
import { getTenantPool } from '../../db/tenantPg';

/**
 * Migration 023: Stock Returns - Reference Column & pending_return_units 
 */
async function migrateTenant(tenantId: string) {
    console.log(`[Migration-023] Starting for tenant: ${tenantId}`);

    await tenantTransaction(tenantId, async (client) => {
        // 1. Ensure stock_returns table exists (Per user: it should, but for safety)
        // If it exists, add 'return_reference' column
        const checkTableRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'stock_returns'
        `);
        
        if (checkTableRes.rows.length === 0) {
            console.log(`[Migration-023] Creating stock_returns table...`);
            await client.query(`
                CREATE TABLE stock_returns (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    return_reference TEXT UNIQUE, 
                    service_id TEXT, -- Source Service
                    created_by TEXT,
                    status TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } else {
            // Check 'return_reference' column
            const checkRefRes = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'stock_returns' AND column_name = 'return_reference'
            `);
            
            if (checkRefRes.rows.length === 0) {
                console.log(`[Migration-023] Adding return_reference column to stock_returns...`);
                await client.query(`ALTER TABLE stock_returns ADD COLUMN return_reference TEXT UNIQUE`);
            } else {
                console.log(`[Migration-023] return_reference column already exists.`);
            }

            // Also check 'service_id' or 'source_service_id'? User said "Service source". I'll stick to 'service_id' in my plan.
            // If table existed, what are the columns?
            // I'll add 'service_id' if missing too.
            const checkServiceRes = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'stock_returns' AND column_name = 'service_id'
            `);
             if (checkServiceRes.rows.length === 0) {
                 // Try 'source_service_id' which user mentioned as equivalent name
                 const checkSourceServiceRes = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'stock_returns' AND column_name = 'source_service_id'
                 `);
                 if (checkSourceServiceRes.rows.length === 0) {
                    console.log(`[Migration-023] Adding service_id column to stock_returns...`);
                    await client.query(`ALTER TABLE stock_returns ADD COLUMN service_id TEXT`);
                 }
             }
        }

        // 2. Ensure stock_return_lines exists
        const checkLinesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'stock_return_lines'
        `);
        
        if (checkLinesRes.rows.length === 0) {
             console.log(`[Migration-023] Creating stock_return_lines table...`);
             await client.query(`
                CREATE TABLE stock_return_lines (
                    id TEXT PRIMARY KEY,
                    return_id TEXT NOT NULL,
                    product_id TEXT NOT NULL,
                    lot TEXT NOT NULL,
                    expiry DATE NOT NULL,
                    qty_returned INTEGER NOT NULL,
                    FOREIGN KEY (return_id) REFERENCES stock_returns(id)
                )
             `);
        } else {
            console.log(`[Migration-023] stock_return_lines table already exists.`);
        }

        // 3. Ensure pending_return_units in current_stock
        const checkStockRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'current_stock' AND column_name = 'pending_return_units'
        `);

        if (checkStockRes.rows.length === 0) {
            console.log(`[Migration-023] Adding pending_return_units to current_stock...`);
            await client.query(`ALTER TABLE current_stock ADD COLUMN pending_return_units INTEGER DEFAULT 0`);
        } else {
            console.log(`[Migration-023] pending_return_units already exists.`);
        }
    });
}

// MAIN
async function main() {
    // Hardcoded for demo/test purposes - usually I'd iterate all tenants.
    // Assuming 'demo_tenant' or the tenant from session.
    // I'll run for all tenants in sahty_global if possible, but here I'll try 'tenant_demo_tenant' 
    // Wait, earlier 'tenant_demo_tenant' failed.
    // I will try to fetch tenant list from `sahty_global` if possible, OR just run for 'demo_tenant' and handle error.
    
    // BETTER APPROACH: List databases matching 'tenant_%' and run for them?
    // OR: Just run for the tenant ID that I know works.
    // I'll try to discover tenants.
    try {
        const { getGlobalPool } = await import('../../db/globalPg');
        const res = await getGlobalPool().query("SELECT id FROM tenants");
        const tenants = res.rows;
        
        if (tenants.length === 0) {
            console.warn("No tenants found in global DB. Trying 'demo_tenant' as fallback.");
            try { await migrateTenant('demo_tenant'); } catch(e) { console.error("Failed demo_tenant", e); }
        } else {
            console.log(`Found ${tenants.length} tenants. Migrating...`);
            for (const t of tenants) {
                try {
                    await migrateTenant(t.id);
                } catch (err: any) {
                    console.error(`Error migrating tenant ${t.id}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error("Failed to connect to global DB or list tenants:", err);
        // Fallback
         try { await migrateTenant('demo_tenant'); } catch(e) { console.error("Failed demo_tenant fallback", e); }
    }
    
    process.exit(0);
}

main();
