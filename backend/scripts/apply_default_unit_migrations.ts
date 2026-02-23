import { getGlobalPool } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import fs from 'fs';
import path from 'path';

async function verifyIdentityMigration() {
    const tenantIdStr = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    
    const globalPool = getGlobalPool();
    const tenantPool = getTenantPool(tenantIdStr);

    try {
        console.log('--- Applying Global Migration 014 ---');
        const globalMigrationPath = path.join(__dirname, '../migrations/pg/global/014_update_default_presc_unit_uuid.sql');
        const globalSql = fs.readFileSync(globalMigrationPath, 'utf-8');
        await globalPool.query(globalSql);
        console.log('✅ Global migration 014 applied successfully.');

        console.log(`--- Applying Tenant Migration 058 to ${tenantIdStr} ---`);
        const tenantMigrationPath = path.join(__dirname, '../migrations/pg/tenant/058_update_default_presc_unit_uuid.sql');
        const tenantSql = fs.readFileSync(tenantMigrationPath, 'utf-8');
        await tenantPool.query(tenantSql);
        console.log(`✅ Tenant migration 058 applied successfully to ${tenantIdStr}.`);

    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        await globalPool.end();
        await tenantPool.end();
    }
}

verifyIdentityMigration();
