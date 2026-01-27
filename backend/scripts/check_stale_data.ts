
import { globalQuery } from '../db/globalPg';

async function run() {
    console.log('🔍 Checking for stale data...');
    
    try {
        const users = await globalQuery("SELECT id, username, client_id FROM users WHERE username = 'aze'");
        console.log('Users found:', users);

        const clients = await globalQuery("SELECT id, designation FROM clients WHERE designation = 'TEST'");
        console.log('Clients found:', clients);
        
    } catch (e: any) {
        console.error('Query failed:', e);
    }
    
    process.exit(0);
}

run().catch(console.error);
