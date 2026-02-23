import { Pool } from 'pg';
import { globalQuery } from '../db/globalPg';

async function cleanupEnvironment() {
    const referenceTenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    
    const adminPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: process.env.PG_DB || 'sahty_emr'
    });

    try {
        console.log(`\n--- 1. Dropping patient_coverages from reference tenant ---`);
        const refDbName = `tenant_${referenceTenantId}`;
        const refPool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: refDbName
        });
        
        try {
            await refPool.query('DROP TABLE IF EXISTS public.patient_coverages CASCADE;');
            console.log(`✅ Successfully dropped patient_coverages from ${refDbName}`);
        } catch (e: any) {
            console.error(`❌ Failed to drop table in ${refDbName}:`, e.message);
        } finally {
            await refPool.end();
        }

        console.log(`\n--- 2. Finding test tenants to delete ---`);
        const tenants = await globalQuery('SELECT id, designation FROM public.tenants WHERE id != $1', [referenceTenantId]);
        
        if (tenants.length === 0) {
            console.log('No other tenants found to delete.');
        } else {
            console.log(`Found ${tenants.length} tenants to delete.`);
            
            for (const t of tenants) {
                console.log(`\nProcessing deletion for tenant: ${t.designation} (${t.id})`);
                const dbName = `tenant_${t.id}`;
                
                // A. Drop physical database
                try {
                    // Terminate active connections first
                    await adminPool.query(`
                        SELECT pg_terminate_backend(pg_stat_activity.pid)
                        FROM pg_stat_activity
                        WHERE pg_stat_activity.datname = $1
                        AND pid <> pg_backend_pid()
                    `, [dbName]);
                    
                    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}";`);
                    console.log(`✅ Dropped database ${dbName}`);
                } catch (e: any) {
                    console.error(`❌ Failed to drop database ${dbName}:`, e.message);
                }
                
                // B. Delete from sahty_global.public.tenants (this should cascade to users if FKs are set up, but let's check)
                try {
                    await globalQuery('DELETE FROM public.tenants WHERE id = $1', [t.id]);
                    console.log(`✅ Removed tenant ${t.id} from global tenant registry`);
                } catch (e: any) {
                    console.error(`❌ Failed to remove tenant ${t.id} from global registry:`, e.message);
                }
            }
        }
        
    } finally {
        await adminPool.end();
        console.log('\nCleanup complete.');
        process.exit(0);
    }
}

cleanupEnvironment().catch(console.error);
