/**
 * Migration: Drop client_request_id from stock_transfers
 * Run with: npx ts-node backend/scripts/migrate_drop_client_request_id.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const globalPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'sahty_global'
});

async function run() {
    console.log('🚀 Starting migration: drop client_request_id from stock_transfers');
    
    try {
        // Get all tenant databases
        const tenantsResult = await globalPool.query(`SELECT id FROM clients`);
        const tenants = tenantsResult.rows;
        
        console.log(`📋 Found ${tenants.length} tenants to process`);
        
        const migrationSql = fs.readFileSync(
            path.join(__dirname, '../../migrations/pg/tenant/013_drop_client_request_id.sql'),
            'utf8'
        );
        
        for (const tenant of tenants) {
            const tenantDbName = `sahty_tenant_${tenant.id.replace(/-/g, '_')}`;
            console.log(`\n🔄 Processing tenant: ${tenant.id} (${tenantDbName})`);
            
            const tenantPool = new Pool({
                host: process.env.PG_HOST || 'localhost',
                port: parseInt(process.env.PG_PORT || '5432'),
                user: process.env.PG_USER || 'sahty',
                password: process.env.PG_PASSWORD || 'sahty_dev_2026',
                database: tenantDbName
            });
            
            try {
                await tenantPool.query(migrationSql);
                console.log(`  ✅ Migration applied successfully`);
            } catch (err: any) {
                if (err.message.includes('does not exist')) {
                    console.log(`  ⏭️ Column already removed or table doesn't exist`);
                } else {
                    console.error(`  ❌ Error: ${err.message}`);
                }
            } finally {
                await tenantPool.end();
            }
        }
        
        console.log('\n✅ Migration complete!');
    } catch (err: any) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await globalPool.end();
    }
}

run();
