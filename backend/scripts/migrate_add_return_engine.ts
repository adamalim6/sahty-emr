/**
 * Migration Script: Add Return Engine Tables
 * 
 * This script adds the stock return workflow tables to all existing tenant databases:
 * - stock_returns (business declaration)
 * - stock_return_lines (declared products)
 * - return_receptions (physical arrivals)
 * - return_reception_lines (received items)
 * - return_decisions (pharmacist decision)
 * - return_decision_lines (outcome allocation)
 * 
 * Also extends current_stock with:
 * - reserved_units
 * - pending_return_units
 * 
 * Run with: npx ts-node backend/scripts/migrate_add_return_engine.ts
 */

import { Pool } from 'pg';

const config = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
};

async function getAllTenantDatabases(): Promise<string[]> {
    const adminPool = new Pool({ ...config, database: 'postgres' });
    try {
        const result = await adminPool.query(`
            SELECT datname FROM pg_database 
            WHERE datname LIKE 'tenant_%' AND datistemplate = false
        `);
        return result.rows.map(r => r.datname);
    } finally {
        await adminPool.end();
    }
}

async function migrateReturnEngine(dbName: string): Promise<void> {
    const pool = new Pool({ ...config, database: dbName });
    const tenantId = dbName.replace('tenant_', '');
    
    try {
        console.log(`\n📦 Processing: ${dbName}`);

        // 1. Extend current_stock with new columns
        try {
            await pool.query(`
                ALTER TABLE current_stock 
                ADD COLUMN IF NOT EXISTS reserved_units INTEGER NOT NULL DEFAULT 0
            `);
            await pool.query(`
                ALTER TABLE current_stock 
                ADD COLUMN IF NOT EXISTS pending_return_units INTEGER NOT NULL DEFAULT 0
            `);
            console.log(`   ✅ Extended current_stock with reserved_units, pending_return_units`);
        } catch (e: any) {
            if (!e.message.includes('already exists')) throw e;
            console.log(`   ✓ current_stock columns already exist`);
        }

        // 2. Create stock_returns table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stock_returns (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id TEXT NOT NULL,
                source_type TEXT NOT NULL CHECK (source_type IN ('SERVICE', 'ADMISSION')),
                source_service_id UUID,
                created_by UUID NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'CANCELLED', 'CLOSED'))
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_returns_tenant ON stock_returns(tenant_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_returns_status ON stock_returns(tenant_id, status)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_returns_service ON stock_returns(source_service_id)`);
        console.log(`   ✅ Created stock_returns table`);

        // 3. Create stock_return_lines table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stock_return_lines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                return_id UUID NOT NULL REFERENCES stock_returns(id) ON DELETE CASCADE,
                product_id UUID NOT NULL,
                lot TEXT NOT NULL,
                expiry DATE NOT NULL,
                source_location_id UUID NOT NULL,
                qty_declared_units INTEGER NOT NULL CHECK (qty_declared_units > 0),
                original_dispense_event_id UUID
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_return_lines_return ON stock_return_lines(return_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_return_lines_product ON stock_return_lines(product_id)`);
        console.log(`   ✅ Created stock_return_lines table`);

        // 4. Create return_receptions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS return_receptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                return_id UUID NOT NULL REFERENCES stock_returns(id) ON DELETE CASCADE,
                received_by UUID NOT NULL,
                received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_receptions_return ON return_receptions(return_id)`);
        console.log(`   ✅ Created return_receptions table`);

        // 5. Create return_reception_lines table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS return_reception_lines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                reception_id UUID NOT NULL REFERENCES return_receptions(id) ON DELETE CASCADE,
                return_line_id UUID NOT NULL REFERENCES stock_return_lines(id),
                qty_received_units INTEGER NOT NULL CHECK (qty_received_units > 0)
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_reception_lines_reception ON return_reception_lines(reception_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_reception_lines_return_line ON return_reception_lines(return_line_id)`);
        console.log(`   ✅ Created return_reception_lines table`);

        // 6. Create return_decisions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS return_decisions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                reception_id UUID NOT NULL REFERENCES return_receptions(id) ON DELETE CASCADE,
                decided_by UUID NOT NULL,
                decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_decisions_reception ON return_decisions(reception_id)`);
        console.log(`   ✅ Created return_decisions table`);

        // 7. Create return_decision_lines table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS return_decision_lines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                decision_id UUID NOT NULL REFERENCES return_decisions(id) ON DELETE CASCADE,
                return_line_id UUID NOT NULL REFERENCES stock_return_lines(id),
                qty_units INTEGER NOT NULL CHECK (qty_units > 0),
                outcome TEXT NOT NULL CHECK (outcome IN ('REINTEGRATE', 'CHARITY', 'WASTE', 'DESTRUCTION'))
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_decision_lines_decision ON return_decision_lines(decision_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_decision_lines_return_line ON return_decision_lines(return_line_id)`);
        console.log(`   ✅ Created return_decision_lines table`);

        console.log(`   ✅ Return Engine migration complete for ${dbName}`);
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        throw error;
    } finally {
        await pool.end();
    }
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              MIGRATION: Return Engine Tables                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    const tenants = await getAllTenantDatabases();
    console.log(`Found ${tenants.length} tenant database(s)`);

    for (const tenantDb of tenants) {
        try {
            await migrateReturnEngine(tenantDb);
        } catch (error) {
            console.error(`Failed to migrate ${tenantDb}:`, error);
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              MIGRATION COMPLETE                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
