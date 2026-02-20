
import { tenantQuery } from '../db/tenantPg';
import { Pool } from 'pg';

const TENANT_ID = '00000000-0000-4000-a000-000000000001';

async function inspect() {
    console.log("🔍 Inspecting Tenant Indexes...");
    try {
        const res = await tenantQuery(TENANT_ID, `
            SELECT tablename, indexname, indexdef 
            FROM pg_indexes 
            WHERE schemaname IN ('public', 'identity_sync')
              AND tablename IN ('identity_ids', 'inbox_events')
            ORDER BY tablename, indexname
        `);
        
        console.table(res);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

inspect();
