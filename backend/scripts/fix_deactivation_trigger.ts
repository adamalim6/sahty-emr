/**
 * Fix: Update deactivation trigger to not reference is_system column
 * 
 * Run with: npx ts-node backend/scripts/fix_deactivation_trigger.ts
 */

import { Pool } from 'pg';

const config = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
};

async function fixTrigger(): Promise<void> {
    console.log('Fixing deactivation trigger in all tenant databases...\n');

    const adminPool = new Pool({ ...config, database: 'postgres' });
    const result = await adminPool.query(`SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'`);
    const tenantDbs = result.rows.map((r: any) => r.datname);
    await adminPool.end();

    for (const dbName of tenantDbs) {
        const pool = new Pool({ ...config, database: dbName });
        try {
            // Drop old trigger
            await pool.query('DROP TRIGGER IF EXISTS trg_prevent_system_location_deactivate ON locations');
            
            // Create fixed function that only checks scope (not is_system which may not exist)
            await pool.query(`
                CREATE OR REPLACE FUNCTION prevent_system_location_deactivate()
                RETURNS trigger AS $$
                BEGIN
                    IF OLD.scope = 'SYSTEM' AND NEW.status = 'INACTIVE' THEN
                        RAISE EXCEPTION 'Cannot deactivate SYSTEM locations';
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            `);
            
            // Recreate trigger
            await pool.query(`
                CREATE TRIGGER trg_prevent_system_location_deactivate
                BEFORE UPDATE OF status ON locations
                FOR EACH ROW
                EXECUTE FUNCTION prevent_system_location_deactivate()
            `);
            console.log(`✅ ${dbName}`);
        } catch (e: any) {
            console.log(`❌ ${dbName}: ${e.message}`);
        }
        await pool.end();
    }
    console.log('\nDone!');
}

fixTrigger().then(() => process.exit(0)).catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
