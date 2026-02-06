
import { tenantQuery } from '../db/tenantPg';
import { getTenantPool } from '../db/tenantPg';

async function main() {
    console.log('Checking current_stock columns for demo_tenant...');
    const result = await tenantQuery('demo_tenant', `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'current_stock'
    `, []);
    console.log(result);
    process.exit(0);
}

main().catch(console.error);
