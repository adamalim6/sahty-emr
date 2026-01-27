
import { globalQuery } from '../db/globalPg';

async function run() {
    try {
        const roles = await globalQuery("SELECT * FROM global_roles");
        console.log('Global Roles:', roles);
    } catch (e: any) {
        console.error('Query failed:', e);
    }
    process.exit(0);
}

run().catch(console.error);
