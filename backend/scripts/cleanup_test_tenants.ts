import { Client } from 'pg';

const targetTenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';

async function main() {
    console.log(`Starting cleanup... Keeping only tenant ${targetTenantId}`);
    
    // 1. Connect to sahty_global to clean up the tenants table
    const globalClient = new Client({
        user: 'sahty',
        host: 'localhost',
        database: 'sahty_global',
        password: 'sahty_dev_2026',
        port: 5432,
    });
    
    await globalClient.connect();
    console.log('Connected to sahty_global database');
    try {
        const res = await globalClient.query(`DELETE FROM public.tenants WHERE id != $1 RETURNING id`, [targetTenantId]);
        console.log(`Deleted ${res.rowCount} test tenants from sahty_global.public.tenants:`);
        console.log(res.rows.map(r => r.id).join('\n'));
    } catch (e) {
        console.error('Error deleting from sahty_global.tenants:', e);
    } finally {
        await globalClient.end();
    }

    // 2. Connect to the default postgres database to drop databases
    const pgClient = new Client({
        user: 'sahty',
        host: 'localhost',
        database: 'postgres',
        password: 'sahty_dev_2026',
        port: 5432,
    });

    await pgClient.connect();
    console.log('\nConnected to postgres database');
    try {
        const dbRes = await pgClient.query(`SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'`);
        const databases = dbRes.rows.map(r => r.datname);
        
        for (const dbName of databases) {
            if (dbName !== `tenant_${targetTenantId}`) {
                console.log(`\nPreparing to drop database: ${dbName}`);
                try {
                    // Terminate active connections first
                    await pgClient.query(`
                        SELECT pg_terminate_backend(pid)
                        FROM pg_stat_activity
                        WHERE datname = $1 AND pid <> pg_backend_pid()
                    `, [dbName]);
                    
                    // Drop the database
                    await pgClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
                    console.log(`Successfully dropped ${dbName}`);
                } catch (err) {
                    console.error(`Failed to drop database ${dbName}:`, err);
                }
            }
        }
    } catch (e) {
        console.error('Error listing/dropping databases:', e);
    } finally {
        await pgClient.end();
    }
    
    console.log('\nCleanup finished.');
}

main().catch(console.error);
