
import { globalQuery } from '../db/globalPg';

async function checkClient() {
    console.log('Checking for tenant 3f6d16da-1989-4f9f-8da3-16816b4ddda0 in global.clients...');
    const res = await globalQuery(`SELECT * FROM clients WHERE id = '3f6d16da-1989-4f9f-8da3-16816b4ddda0'`);
    if (res.length > 0) {
        console.log('✅ Client Found!', res[0]);
    } else {
        console.error('❌ Client NOT Found in global.clients table!');
    }
}

checkClient().catch(console.error);
