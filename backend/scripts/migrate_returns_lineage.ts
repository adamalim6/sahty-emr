import fs from 'fs';
import path from 'path';
import { getGlobalPool } from '../db/globalPg';
import { Pool } from 'pg';

const MIGRATION_FILE = path.join(__dirname, '../../migrations/pg/tenant/016_add_return_reference.sql');

async function run() {
    console.log('Starting Returns Lineage Migration...');
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
    
    // 1. Get all tenants
    const globalPool = getGlobalPool();
    const tenants = await globalPool.query('SELECT id FROM clients');
    
    console.log(`Found ${tenants.rows.length} tenants.`);

    for (const tenant of tenants.rows) {
        const dbName = `tenant_${tenant.id}`;
        console.log(`Migrating tenant: ${dbName}`);
        const tenantPool = new Pool({
            connectionString: process.env.DATABASE_URL?.replace('sahty_global', dbName) || `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}`
        });
        
        try {
            await tenantPool.query(sql);
            console.log(`✅ Success: ${tenant.db_name}`);
        } catch (e) {
            console.error(`❌ Failed: ${tenant.db_name}`, e);
        } finally {
            await tenantPool.end();
        }
    }
    
    console.log('Migration Complete.');
    process.exit(0);
}

run().catch(console.error);
