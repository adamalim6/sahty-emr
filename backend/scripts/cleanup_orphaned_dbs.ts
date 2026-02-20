
import { Pool } from 'pg';

const REF_TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';
const REF_DB_NAME = `tenant_${REF_TENANT_ID}`;

const adminPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'postgres' // Connect to postgres to see all DBs
});

async function dropDatabase(dbName: string) {
    try {
        console.log(`Killing connections to ${dbName}...`);
        await adminPool.query(`
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1 AND pid <> pg_backend_pid()
        `, [dbName]);

        console.log(`Dropping ${dbName}...`);
        await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        console.log(`✅ Dropped ${dbName}`);
    } catch (err: any) {
        console.error(`❌ Failed to drop ${dbName}: ${err.message}`);
    }
}

async function run() {
    console.log(`🔍 Scanning for orphaned databases...`);
    
    try {
        const res = await adminPool.query(`
            SELECT datname FROM pg_database 
            WHERE datname LIKE 'tenant_%' OR datname LIKE 'group_%'
        `);
        
        const dbs = res.rows.map(r => r.datname);
        const toDrop = dbs.filter(name => name !== REF_DB_NAME);

        if (toDrop.length === 0) {
            console.log("No orphaned databases found.");
            return;
        }

        console.log(`Found ${toDrop.length} databases to purge:`, toDrop);

        for (const dbName of toDrop) {
            await dropDatabase(dbName);
        }

        console.log("✨ database cleanup complete.");

    } catch (err: any) {
        console.error("Error listing databases:", err);
    } finally {
        await adminPool.end();
    }
}

run();
