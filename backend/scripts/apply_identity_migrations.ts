/**
 * Apply identity-related migrations (040–045) to ALL existing tenant databases.
 * 
 * Usage:
 *   cd backend && npx ts-node scripts/apply_identity_migrations.ts
 * 
 * Env vars inherited from the running backend:
 *   PG_HOST, PG_PORT, PG_USER, PG_PASSWORD
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432');
const PG_USER = process.env.PG_USER || 'sahty';
const PG_PASSWORD = process.env.PG_PASSWORD || 'sahty_dev_2026';
const GLOBAL_DB = process.env.PG_DB || 'sahty_global';

const MIGRATION_DIR = path.join(__dirname, '..', 'migrations', 'pg', 'tenant');

// Ordered list of migrations to apply
const MIGRATIONS = [
    '040_refactor_identity_destructive.sql',
    '041_create_new_identity_tables.sql',
    '042_setup_sync_schema.sql',
    '043_add_identity_ids_constraint.sql',
    '043_fix_audit_trigger.sql',
    '044_admission_coverages.sql',
    '045_add_related_phone.sql',
    '046_expand_coverage_members.sql',
];

async function getExistingTenants(): Promise<{ id: string; designation: string }[]> {
    const pool = new Pool({
        host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD,
        database: GLOBAL_DB,
    });
    try {
        const res = await pool.query(`SELECT id, designation FROM public.tenants ORDER BY designation`);
        return res.rows;
    } finally {
        await pool.end();
    }
}

async function applyMigrationToTenant(tenantId: string, designation: string): Promise<void> {
    const dbName = `tenant_${tenantId}`;
    const pool = new Pool({
        host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD,
        database: dbName,
    });

    try {
        console.log(`\n=== Tenant: ${designation} (${dbName}) ===`);
        
        for (const migFile of MIGRATIONS) {
            const filePath = path.join(MIGRATION_DIR, migFile);
            if (!fs.existsSync(filePath)) {
                console.log(`  ⏭  ${migFile} — file not found, skipping`);
                continue;
            }
            
            const sql = fs.readFileSync(filePath, 'utf-8');
            try {
                await pool.query(sql);
                console.log(`  ✅ ${migFile}`);
            } catch (err: any) {
                // If the table/index/constraint already exists, that's fine
                if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
                    console.log(`  ⚠️  ${migFile} — already applied (${err.message.slice(0, 80)})`);
                } else {
                    console.error(`  ❌ ${migFile} — ERROR: ${err.message}`);
                }
            }
        }
        
        console.log(`  🏁 Done for ${designation}`);
    } finally {
        await pool.end();
    }
}

async function main() {
    console.log('🔄 Applying identity migrations (040–045) to all tenant databases...\n');
    
    const tenants = await getExistingTenants();
    console.log(`Found ${tenants.length} tenant(s):`);
    tenants.forEach(t => console.log(`  - ${t.designation} (${t.id})`));
    
    for (const tenant of tenants) {
        await applyMigrationToTenant(tenant.id, tenant.designation);
    }
    
    console.log('\n✅ All tenant databases processed.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
