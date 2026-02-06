import { tenantQuery } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function run() {
    try {
        // Check inventory_movements columns
        const movCols = await tenantQuery(TENANT_ID, `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'inventory_movements'
            ORDER BY ordinal_position
        `);
        console.log('inventory_movements columns:', movCols.map((c: any) => c.column_name));
        
        // Check current_stock columns
        const stockCols = await tenantQuery(TENANT_ID, `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'current_stock'
            ORDER BY ordinal_position
        `);
        console.log('current_stock columns:', stockCols.map((c: any) => c.column_name));
        
        process.exit(0);
    } catch (e: any) {
        console.error(e);
        process.exit(1);
    }
}

run();
