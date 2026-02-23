import { getTenantPool } from '../db/tenantPg';
import { syncTenantReference } from './referenceSync';

async function testSync() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    const client = await pool.connect();
    try {
        await syncTenantReference(client, tenantId);
        console.log('[+] Sync completed successfully for test tenant.');
    } catch (e) {
        console.error('[-] Sync failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}
testSync();
