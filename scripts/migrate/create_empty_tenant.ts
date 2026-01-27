/**
 * Create Empty Tenant Database
 * 
 * Creates an EMPTY tenant database with schema only.
 * NO DATA is seeded - all configuration must be created via UI.
 * 
 * Usage: npx ts-node scripts/migrate/create_empty_tenant.ts <tenant_id>
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const TENANT_SCHEMA_PATH = path.join(__dirname, '../../migrations/pg/tenant/000_init.sql');
const TENANT_INDEXES_PATH = path.join(__dirname, '../../migrations/pg/tenant/010_indexes.sql');

async function createEmptyTenant(tenantId: string): Promise<void> {
    const dbName = `sahty_tenant_${tenantId}`;
    
    console.log('='.repeat(60));
    console.log('CREATE EMPTY TENANT DATABASE');
    console.log('='.repeat(60));
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Database: ${dbName}\n`);

    // Connect to default postgres database for admin operations
    const adminPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'postgres'
    });

    try {
        // 1. Check if database already exists
        const existsResult = await adminPool.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [dbName]
        );

        if (existsResult.rows.length > 0) {
            console.log(`⚠️ Database ${dbName} already exists`);
            console.log('   Use --force to drop and recreate, or continue with schema update');
            
            if (process.argv.includes('--force')) {
                console.log('   --force detected: Dropping existing database...');
                await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
            } else {
                // Update schema only
                const tenantPool = new Pool({
                    host: process.env.PG_HOST || 'localhost',
                    port: parseInt(process.env.PG_PORT || '5432'),
                    user: process.env.PG_USER || 'sahty',
                    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
                    database: dbName
                });

                try {
                    await applySchema(tenantPool);
                    console.log('\n✅ Schema updated for existing database');
                } finally {
                    await tenantPool.end();
                }
                return;
            }
        }

        // 2. Create database
        console.log('📦 Creating database...');
        await adminPool.query(`CREATE DATABASE "${dbName}"`);
        console.log(`   ✅ Database ${dbName} created`);

    } finally {
        await adminPool.end();
    }

    // 3. Connect to new database and apply schema
    const tenantPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: dbName
    });

    try {
        await applySchema(tenantPool);
        console.log('\n✅ Empty tenant database created successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. Create Services via Paramétrage UI');
        console.log('   2. Create Locations via Paramétrage UI');
        console.log('   3. Create Users and Roles via Paramétrage UI');
        console.log('   4. Activate Products from Global Catalog');
        console.log('   5. Configure Prices for activated products');

    } finally {
        await tenantPool.end();
    }
}

async function applySchema(pool: Pool): Promise<void> {
    // Apply main schema
    if (fs.existsSync(TENANT_SCHEMA_PATH)) {
        console.log('\n📝 Applying tenant schema (000_init.sql)...');
        const schema = fs.readFileSync(TENANT_SCHEMA_PATH, 'utf-8');
        await pool.query(schema);
        console.log('   ✅ Schema applied');
    } else {
        console.log(`   ⚠️ Schema file not found: ${TENANT_SCHEMA_PATH}`);
    }

    // Apply indexes
    if (fs.existsSync(TENANT_INDEXES_PATH)) {
        console.log('\n📝 Applying indexes (010_indexes.sql)...');
        const indexes = fs.readFileSync(TENANT_INDEXES_PATH, 'utf-8');
        await pool.query(indexes);
        console.log('   ✅ Indexes applied');
    }

    // Verify tables created
    const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    `);

    console.log(`\n📊 Tables created: ${tables.rows.length}`);
    for (const row of tables.rows) {
        // Verify table is empty
        const countResult = await pool.query(`SELECT COUNT(*) as c FROM ${row.table_name}`);
        const count = parseInt(countResult.rows[0].c);
        const status = count === 0 ? '✅ EMPTY' : `⚠️ ${count} rows`;
        console.log(`   ${row.table_name}: ${status}`);
    }
}

async function main() {
    const tenantId = process.argv[2];

    if (!tenantId) {
        console.error('Usage: npx ts-node scripts/migrate/create_empty_tenant.ts <tenant_id>');
        console.error('       npx ts-node scripts/migrate/create_empty_tenant.ts <tenant_id> --force');
        process.exit(1);
    }

    await createEmptyTenant(tenantId);
}

main().catch(err => {
    console.error('Failed to create tenant:', err);
    process.exit(1);
});
