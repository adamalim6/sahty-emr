/**
 * Create tenant database and apply init schema
 * Usage: npx ts-node --transpile-only create_tenant_db.ts demo_tenant
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const tenantId = process.argv[2];
    if (!tenantId) {
        console.error('Usage: npx ts-node create_tenant_db.ts <tenantId>');
        process.exit(1);
    }

    const dbName = `tenant_${tenantId}`;
    console.log(`Creating database: ${dbName}`);

    // Connect to postgres (admin) database
    const adminPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'postgres',
    });

    try {
        // Check if database exists
        const check = await adminPool.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [dbName]
        );

        if (check.rows.length === 0) {
            // Create database
            await adminPool.query(`CREATE DATABASE "${dbName}"`);
            console.log(`✅ Database created: ${dbName}`);
        } else {
            console.log(`⚠️ Database already exists: ${dbName}`);
        }
    } finally {
        await adminPool.end();
    }

    // Now connect to tenant database and apply schema
    const tenantPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: dbName,
    });

    try {
        // Read init migration
        const migrationPath = path.join(__dirname, '..', 'migrations', 'pg', 'tenant', '000_init.sql');
        const schemaSql = fs.readFileSync(migrationPath, 'utf-8');
        
        console.log('Applying tenant schema...');
        await tenantPool.query(schemaSql);
        console.log('✅ Schema applied successfully');

        // Verify tables created
        const tables = await tenantPool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        console.log(`\nTables created (${tables.rows.length}):`);
        for (const row of tables.rows) {
            console.log(`  - ${row.table_name}`);
        }
    } finally {
        await tenantPool.end();
    }

    console.log('\n✅ Tenant database ready for testing');
}

main().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
