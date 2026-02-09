
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';
import { syncTenantReference } from './referenceSync';

const TARGET_TENANT = '3f6d16da-1989-4f9f-8da3-16816b4ddda0';

async function fixTenant() {
    console.log(`--- Fixing Tenant ${TARGET_TENANT} ---`);
    const pool = getTenantPool(TARGET_TENANT);
    const client = await pool.connect();
    
    try {
        const migrationsDir = path.join(__dirname, '../migrations/pg/tenant');

        // 0. Apply 001
        console.log('Running 001_identity_schema_tenant.sql...');
        const sql001 = fs.readFileSync(path.join(migrationsDir, '001_identity_schema_tenant.sql'), 'utf-8');
        await client.query(sql001);
        console.log('✅ 001 Applied.');

        // 1. Apply 002
        console.log('Running 002_refactor_patient_tenant.sql...');
        const sql002 = fs.readFileSync(path.join(migrationsDir, '002_refactor_patient_tenant.sql'), 'utf-8');
        await client.query(sql002);
        console.log('✅ 002 Applied.');

        // 2. Apply 003
        console.log('Running 003_drop_global_patient_id.sql...');
        const sql003 = fs.readFileSync(path.join(migrationsDir, '003_drop_global_patient_id.sql'), 'utf-8');
        await client.query(sql003);
        console.log('✅ 003 Applied.');

        // 3. Sync Reference Data (needed for 004 foreign key)
        console.log('Syncing Reference Data...');
        await syncTenantReference(client, TARGET_TENANT);
        console.log('✅ Reference Synced.');

        // 4. Apply 004
        console.log('Running 004_fix_tenant_document_types.sql...');
        const sql004 = fs.readFileSync(path.join(migrationsDir, '004_fix_tenant_document_types.sql'), 'utf-8');
        await client.query(sql004);
        console.log('✅ 004 Applied.');

        console.log('--- Tenant Fixed Successfully ---');

    } catch (e) {
        console.error('❌ Fix Failed:', e);
    } finally {
        client.release();
    }
}

fixTenant().catch(console.error);
