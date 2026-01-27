
import { globalQuery } from '../db/globalPg';

async function verify() {
    console.log('🔍 VERIFYING TENANT RESET...');
    let passed = true;

    // 1. Check Tenant Databases
    const dbs = await globalQuery<{datname: string}>('SELECT datname FROM pg_database WHERE datname LIKE \'tenant_%\'');
    if (dbs.length === 0) {
        console.log('✅ Tenant Databases: 0 (Correct)');
    } else {
        console.error(`❌ Tenant Databases: Found ${dbs.length} (Expected 0)`);
        console.error('   ', dbs.map(d => d.datname));
        passed = false;
    }

    // 2. Check Clients
    const clients = await globalQuery<{count: string}>('SELECT count(*) FROM clients');
    const clientCount = parseInt(clients[0].count);
    if (clientCount === 0) {
        console.log('✅ Clients: 0 (Correct)');
    } else {
        console.error(`❌ Clients: Found ${clientCount} (Expected 0)`);
        passed = false;
    }

    // 3. Check Users
    const users = await globalQuery<{count: string}>('SELECT count(*) FROM users');
    const userCount = parseInt(users[0].count);
    
    const superAdmins = await globalQuery<{username: string, user_type: string}>('SELECT username, user_type FROM users WHERE user_type = \'SUPER_ADMIN\'');
    
    if (userCount === superAdmins.length && superAdmins.length > 0) {
        console.log(`✅ Users: ${userCount} (All Super Admins)`);
    } else {
         console.error(`❌ Users: Found ${userCount} (Expected same as Super Admins: ${superAdmins.length})`);
         if (superAdmins.length === 0) console.error('   ⚠️ WARNING: No Super Admin found!');
         const otherUsers = await globalQuery('SELECT username, user_type FROM users WHERE user_type != \'SUPER_ADMIN\'');
         if (otherUsers.length > 0) console.error('   Found non-super users:', otherUsers);
         passed = false;
    }

    if (passed) {
        console.log('✅ VERIFICATION PASSED: Environment is clean.');
        process.exit(0);
    } else {
        console.error('❌ VERIFICATION FAILED');
        process.exit(1);
    }
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
