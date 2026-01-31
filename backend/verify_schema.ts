import { tenantQuery } from './db/tenantPg';

(async () => {
    const tenantId = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';
    
    // Check header schema
    const headerCols = await tenantQuery(tenantId, 
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_reservations' ORDER BY ordinal_position"
    );
    console.log('stock_reservations columns:', headerCols.map((c: any) => c.column_name).join(', '));
    
    // Check lines schema
    const lineCols = await tenantQuery(tenantId,
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_reservation_lines' ORDER BY ordinal_position"
    );
    console.log('\nstock_reservation_lines columns:', lineCols.map((c: any) => c.column_name).join(', '));
    
    // Check transfer lineage columns
    const transferCols = await tenantQuery(tenantId,
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_transfers' AND column_name = 'stock_reservation_id'"
    );
    console.log('\nstock_transfers.stock_reservation_id exists:', transferCols.length > 0);
    
    const lineFk = await tenantQuery(tenantId,
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_transfer_lines' AND column_name = 'reservation_line_id'"
    );
    console.log('stock_transfer_lines.reservation_line_id exists:', lineFk.length > 0);
    
    process.exit(0);
})();
