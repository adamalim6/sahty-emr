
import { globalQuery, closeGlobalPool } from '../db/globalPg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const REF_TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function applyFix() {
    console.log("🛠️  APPLYING AUDIT TRIGGER FIX (043) TO ALL TENANTS 🛠️\n");

    try {
        // 1. Get Tenants
        const rows = await globalQuery("SELECT id FROM tenants");
        const tenants = rows.map(r => r.id);
        console.log(`Found ${tenants.length} tenants.`);

        const fixSqlPath = path.join(__dirname, '../migrations/pg/tenant/043_fix_audit_trigger.sql');
        if (!fs.existsSync(fixSqlPath)) {
            throw new Error("Fix SQL file not found!");
        }
        const fixSql = fs.readFileSync(fixSqlPath, 'utf-8');

        for (const tenantId of tenants) {
            if (tenantId === REF_TENANT_ID) {
                console.log(`🛡️  Skipping Reference Tenant ${tenantId}`);
                continue;
            }

            console.log(`Processing ${tenantId}...`);
            const dbName = `tenant_${tenantId}`; // Simplified naming convention
            
            const pool = new Pool({
                host: process.env.PG_HOST || 'localhost',
                port: parseInt(process.env.PG_PORT || '5432'),
                user: process.env.PG_USER || 'sahty',
                password: process.env.PG_PASSWORD || 'sahty_dev_2026',
                database: dbName
            });

            try {
                await pool.query(fixSql);
                console.log(`  ✅ Fix applied.`);
            } catch (e: any) {
                console.error(`  ❌ Failed: ${e.message}`);
                // If DB doesn't exist, ignore
            } finally {
                await pool.end();
            }
        }

        console.log("\n✨ FIX COMPLETE ✨");

    } catch (e: any) {
        console.error("Fatal Error:", e);
    } finally {
        await closeGlobalPool();
    }
}

applyFix();
