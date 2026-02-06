/**
 * Reset all stuck demand locks (processing_status = 'IN_PROGRESS')
 * Run: cd backend && npx ts-node scripts/reset_demand_locks.ts
 */

import { globalAdminService } from '../services/globalAdminService';
import { tenantQuery, closeAllTenantPools } from '../db/tenantPg';
import { closeGlobalPool } from '../db/globalPg';

async function resetLocks() {
    console.log("Resetting all demand locks...");
    
    try {
        const clients = await globalAdminService.getAllClients();
        console.log(`Found ${clients.length} tenants.`);

        for (const client of clients) {
            try {
                const result = await tenantQuery(client.id, `
                    UPDATE stock_demands 
                    SET processing_status = 'OPEN', assigned_user_id = NULL, claimed_at = NULL
                    WHERE processing_status = 'IN_PROGRESS'
                    RETURNING id, demand_ref
                `);
                
                if (result.length > 0) {
                    console.log(`✅ Reset ${result.length} demand(s) in ${client.designation}:`, result.map(r => r.demand_ref || r.id));
                }
            } catch (e: any) {
                if (!e.message.includes('does not exist')) {
                    console.error(`❌ Failed: ${client.id}`, e.message);
                }
            }
        }
    } catch (err: any) {
        console.error("Fatal error:", err);
    } finally {
        await closeAllTenantPools();
        await closeGlobalPool();
        process.exit(0);
    }
}

resetLocks();
