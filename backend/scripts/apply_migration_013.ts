/**
 * Apply migration 013_patient_identity_refactor
 * 
 * Drops nationality_id from patients_tenant and nationality_code from identity.master_patients
 * across ALL tenant databases and the central sahty_identity database.
 */

import { Pool } from 'pg';

const baseConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
};

const MIGRATION_SQL = `
-- Drop nationality_id from patients_tenant
ALTER TABLE patients_tenant DROP COLUMN IF EXISTS nationality_id;

-- Drop nationality_code from identity.master_patients
ALTER TABLE identity.master_patients DROP COLUMN IF EXISTS nationality_code;

-- Add index on patient_documents(issuing_country_code)
CREATE INDEX IF NOT EXISTS idx_patient_documents_country ON patient_documents (issuing_country_code);
`;

const IDENTITY_MIGRATION_SQL = `
-- Drop nationality_code from identity.master_patients in central identity DB
ALTER TABLE identity.master_patients DROP COLUMN IF EXISTS nationality_code;
`;

async function discoverTenantDbs(): Promise<string[]> {
    const adminPool = new Pool({ ...baseConfig, database: 'postgres' });
    try {
        const res = await adminPool.query(
            "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' ORDER BY datname"
        );
        return res.rows.map((r: any) => r.datname);
    } finally {
        await adminPool.end();
    }
}

async function applyToDatabase(dbName: string, sql: string): Promise<void> {
    const pool = new Pool({ ...baseConfig, database: dbName });
    try {
        await pool.query(sql);
        console.log(`✅ ${dbName}: Migration applied successfully`);
    } catch (err: any) {
        console.error(`❌ ${dbName}: ${err.message}`);
    } finally {
        await pool.end();
    }
}

async function verifyColumn(dbName: string, schema: string, table: string, column: string): Promise<boolean> {
    const pool = new Pool({ ...baseConfig, database: dbName });
    try {
        const res = await pool.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
            [schema, table, column]
        );
        return res.rows.length > 0;
    } finally {
        await pool.end();
    }
}

async function main() {
    console.log('=== Migration 013: Patient Identity Refactor ===\n');

    // 1. Discover tenant databases
    console.log('📋 Discovering tenant databases...');
    const tenantDbs = await discoverTenantDbs();
    console.log(`   Found ${tenantDbs.length} tenant DB(s): ${tenantDbs.join(', ')}\n`);

    // 2. Apply to each tenant DB
    console.log('🔄 Applying migration to tenant databases...');
    for (const db of tenantDbs) {
        await applyToDatabase(db, MIGRATION_SQL);
    }

    // 3. Apply to sahty_identity
    console.log('\n🔄 Applying migration to sahty_identity...');
    await applyToDatabase('sahty_identity', IDENTITY_MIGRATION_SQL);

    // 4. Verify
    console.log('\n📊 Verification:');
    
    for (const db of tenantDbs) {
        const hasNationalityId = await verifyColumn(db, 'public', 'patients_tenant', 'nationality_id');
        const hasNationalityCode = await verifyColumn(db, 'identity', 'master_patients', 'nationality_code');
        console.log(`   ${db}:`);
        console.log(`     patients_tenant.nationality_id:        ${hasNationalityId ? '❌ STILL EXISTS' : '✅ REMOVED'}`);
        console.log(`     identity.master_patients.nationality_code: ${hasNationalityCode ? '❌ STILL EXISTS' : '✅ REMOVED'}`);
    }

    const identityHasNationality = await verifyColumn('sahty_identity', 'identity', 'master_patients', 'nationality_code');
    console.log(`   sahty_identity:`);
    console.log(`     identity.master_patients.nationality_code: ${identityHasNationality ? '❌ STILL EXISTS' : '✅ REMOVED'}`);

    console.log('\n✅ Migration 013 complete.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
