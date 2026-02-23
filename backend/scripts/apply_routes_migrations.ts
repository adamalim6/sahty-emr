import { getGlobalPool } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import fs from 'fs';
import path from 'path';

async function migrateRoutesCatalog() {
    const tenantIdStr = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    
    const globalPool = getGlobalPool();
    const tenantPool = getTenantPool(tenantIdStr);

    try {
        console.log('--- Applying Global Migration 015 & 016 ---');
        
        const globalSql15 = fs.readFileSync(path.join(__dirname, '../migrations/pg/global/015_create_routes_catalog.sql'), 'utf-8');
        await globalPool.query(globalSql15);
        console.log('✅ Global migration 015 applied (routes catalog created and seeded).');

        const globalSql16 = fs.readFileSync(path.join(__dirname, '../migrations/pg/global/016_update_default_presc_route_uuid.sql'), 'utf-8');
        await globalPool.query(globalSql16);
        console.log('✅ Global migration 016 applied (default_presc_route migrated).');

        console.log(`--- Applying Tenant Migration 059 & 060 to ${tenantIdStr} ---`);
        
        const tenantSql59 = fs.readFileSync(path.join(__dirname, '../migrations/pg/tenant/059_create_routes_catalog.sql'), 'utf-8');
        await tenantPool.query(tenantSql59);
        console.log(`✅ Tenant migration 059 applied (routes table created).`);

        // Sync data from global to tenant
        const { rows: globalRoutes } = await globalPool.query(`SELECT id, code, label, is_active, sort_order, created_at, updated_at FROM public.routes`);
        
        // Insert into tenant
        if (globalRoutes.length > 0) {
            const client = await tenantPool.connect();
            try {
                await client.query('BEGIN');
                for (const r of globalRoutes) {
                    await client.query(
                        `INSERT INTO reference.routes (id, code, label, is_active, sort_order, created_at, updated_at) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (code) DO NOTHING`,
                        [r.id, r.code, r.label, r.is_active, r.sort_order, r.created_at, r.updated_at]
                    );
                }
                await client.query('COMMIT');
                console.log(`✅ Synced ${globalRoutes.length} routes from global to tenant ${tenantIdStr}.`);
            } catch(e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        }

        const tenantSql60 = fs.readFileSync(path.join(__dirname, '../migrations/pg/tenant/060_update_default_presc_route_uuid.sql'), 'utf-8');
        await tenantPool.query(tenantSql60);
        console.log(`✅ Tenant migration 060 applied (default_presc_route migrated).`);

    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        await globalPool.end();
        await tenantPool.end();
    }
}

migrateRoutesCatalog();
