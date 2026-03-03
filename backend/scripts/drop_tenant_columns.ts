import { getGlobalPool } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';

async function dropTenantColumns() {
    console.log('--- Starting Tenant Schema Cleanup ---');
    
    const globalPool = getGlobalPool();
    const globalClient = await globalPool.connect();
    
    let tenants: any[] = [];
    try {
        const res = await globalClient.query(`SELECT id FROM public.tenants`);
        tenants = res.rows;
    } finally {
        globalClient.release();
    }

    console.log(`Found ${tenants.length} tenants:`, tenants.map(t => t.id));

    for (const tenant of tenants) {
        console.log(`\n> Migrating Tenant: ${tenant.id}`);
        const pool = getTenantPool(tenant.id);
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            await client.query(`
                ALTER TABLE reference.global_actes 
                DROP COLUMN IF EXISTS famille_sih, 
                DROP COLUMN IF EXISTS sous_famille_sih;
            `);

            await client.query('COMMIT');
            console.log(`  ✅ Successfully dropped legacy columns for tenant ${tenant.id}`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`  ❌ Failed cleaning tenant ${tenant.id}:`, e);
        } finally {
            client.release();
            await pool.end();
        }
    }

    await globalPool.end();
    console.log('\n--- Tenant Cleanup Complete ---');
}

dropTenantColumns().catch(console.error);
