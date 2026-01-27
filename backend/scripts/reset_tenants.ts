
import { globalQuery } from '../db/globalPg';
import { Pool } from 'pg';

async function run() {
    console.log('🚨 STARTING COMPLETE TENANT RESET 🚨');

    // 1. Identify Tenant Databases to Drop
    console.log('Finding tenant databases...');
    const dbs = await globalQuery<{datname: string}>('SELECT datname FROM pg_database WHERE datname LIKE \'tenant_%\'');
    console.log(`Found ${dbs.length} tenant databases to drop:`, dbs.map(d => d.datname));

    // 2. Drop Databases
    // We need a separate connection usually to drop DBs? 
    // globalQuery uses a pool connected to sahty_global. 
    // We can drop OTHER databases from here as long as we are superuser (likely 'postgres' or owner).
    // Assuming 'sahty' user has sufficient privileges.

    for (const db of dbs) {
        const dbName = db.datname;
        console.log(`Dropping ${dbName}...`);
        try {
            // Terminate connections first
            await globalQuery(`
                SELECT pg_terminate_backend(pid) 
                FROM pg_stat_activity 
                WHERE datname = $1 AND pid <> pg_backend_pid()
            `, [dbName]);

            // Drop DB
            // DROP DATABASE cannot run in a transaction block. globalQuery might use one? No, it uses pool.query directly.
            await globalQuery(`DROP DATABASE "${dbName}"`);
            console.log(`✅ Dropped ${dbName}`);
        } catch (e: any) {
            console.error(`❌ Failed to drop ${dbName}:`, e.message);
        }
    }

    // 3. Delete Data from Global DB
    console.log('Cleaning Global Tables...');
    
    // Delete Users (Keep Super Admin)
    const delUsers = await globalQuery(`
        DELETE FROM users 
        WHERE user_type != 'SUPER_ADMIN' 
        RETURNING id, username
    `);
    console.log(`Deleted ${delUsers.length} users (kept Super Admins).`);

    // Delete Clients
    const delClients = await globalQuery(`
        DELETE FROM clients 
        RETURNING id, designation
    `);
    console.log(`Deleted ${delClients.length} clients.`);

    console.log('✅ RESET COMPLETE.');
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
