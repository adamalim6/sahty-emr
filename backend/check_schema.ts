
import { getTenantPool } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function main() {
    try {
        const pool = getTenantPool(TENANT_ID);
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stock_transfer_lines'
        `);
        
        console.log('Columns in stock_transfer_lines:');
        result.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
        
    } catch (e) {
        console.error(e);
    }
}

main();
