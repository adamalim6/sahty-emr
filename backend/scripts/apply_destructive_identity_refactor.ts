
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// --- CONFIG ---
const PROTECTED_TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

const baseConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
};

// --- MIGRATION FILES ---
const TENANT_MIGRATIONS = [
    '040_refactor_identity_destructive.sql',
    '041_create_new_identity_tables.sql',
    '042_setup_sync_schema.sql'
];

const GLOBAL_MIGRATION = '005_reinit_central_identity.sql';

// --- HELPERS ---

function readSql(filename: string, isGlobal: boolean = false): string {
    const dir = isGlobal ? 'global' : 'tenant';
    const filePath = path.join(__dirname, `../migrations/pg/${dir}/${filename}`);
    return fs.readFileSync(filePath, 'utf8');
}

async function getTenants(): Promise<string[]> {
    const pool = new Pool({ ...baseConfig, database: 'postgres' });
    try {
        const res = await pool.query(
            "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'"
        );
        return res.rows
            .map((r: any) => r.datname)
            .map((db: string) => db.replace('tenant_', '')); // Return UUIDs
    } finally {
        await pool.end();
    }
}

async function runSql(dbName: string, sql: string) {
    const pool = new Pool({ ...baseConfig, database: dbName });
    try {
        await pool.query(sql);
    } finally {
        await pool.end();
    }
}

// --- MAIN ---

async function main() {
    console.log('🚨 STARTING DESTRUCTIVE IDENTITY REFACTOR 🚨\n');

    // 1. Identify Tenants
    const allTenants = await getTenants();
    const targetTenants = allTenants.filter(t => t !== PROTECTED_TENANT_ID);
    
    console.log(`Found ${allTenants.length} tenants.`);
    console.log(`🛡️  PROTECTED: tenant_${PROTECTED_TENANT_ID}`);
    console.log(`🎯 TARGETS: ${targetTenants.length} tenants (e.g. ${targetTenants[0] || 'none'})\n`);

    if (targetTenants.length === 0) {
        console.log('No target tenants found. Skipping tenant migrations.');
    }

    // 2. Apply Tenant Migrations
    for (const tenantId of targetTenants) {
        const dbName = `tenant_${tenantId}`;
        console.log(`\nProcessing ${dbName}...`);
        
        for (const migration of TENANT_MIGRATIONS) {
            console.log(`  - Applying ${migration}...`);
            const sql = readSql(migration);
            try {
                await runSql(dbName, sql);
                console.log(`    ✅ Success`);
            } catch (e: any) {
                console.error(`    ❌ FAILED: ${e.message}`);
                process.exit(1);
            }
        }
    }

    // 3. Apply Central Migration
    console.log(`\nProcessing Central DB (sahty_identity)...`);
    console.log(`  - Applying ${GLOBAL_MIGRATION}...`);
    const globalSql = readSql(GLOBAL_MIGRATION, true);
    try {
        await runSql('sahty_identity', globalSql);
        console.log(`    ✅ Success`);
    } catch (e: any) {
        console.error(`    ❌ FAILED: ${e.message}`);
        process.exit(1);
    }

    console.log('\n✨ REFAC COMPLETE ✨');
}

main().catch(console.error);
