


import { globalAdminService } from '../services/globalAdminService';
import { tenantQuery, closeAllTenantPools } from '../db/tenantPg';
import { closeGlobalPool } from '../db/globalPg';

async function migrate() {
    console.log("Starting migration 013 (Missing Columns Fix)...");
    
    try {
        const clients = await globalAdminService.getAllClients();
        console.log(`Found ${clients.length} tenants.`);

        for (const client of clients) {
            console.log(`Migrating tenant: ${client.id} (${client.designation})`);
            try {
                // Add processing_status
                await tenantQuery(client.id, `
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_demands' AND column_name='processing_status') THEN 
                            ALTER TABLE stock_demands ADD COLUMN processing_status TEXT CHECK (processing_status IN ('OPEN', 'IN_PROGRESS')) NOT NULL DEFAULT 'OPEN';
                        END IF;
                    END $$;
                `);

                // Add assigned_user_id
                await tenantQuery(client.id, `
                   DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_demands' AND column_name='assigned_user_id') THEN 
                            ALTER TABLE stock_demands ADD COLUMN assigned_user_id TEXT;
                        END IF;
                    END $$;
                `);

                // Add claimed_at
                await tenantQuery(client.id, `
                   DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_demands' AND column_name='claimed_at') THEN 
                            ALTER TABLE stock_demands ADD COLUMN claimed_at TIMESTAMPTZ;
                        END IF;
                    END $$;
                `);

                // Add released_at
                await tenantQuery(client.id, `
                   DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_demands' AND column_name='released_at') THEN 
                            ALTER TABLE stock_demands ADD COLUMN released_at TIMESTAMPTZ;
                        END IF;
                    END $$;
                `);

                console.log(`✅ Success: ${client.id}`);
            } catch (e: any) {
                console.error(`❌ Failed: ${client.id}`, e.message);
            }
        }
    } catch (err: any) {
        console.error("Migration fatal error:", err);
    } finally {
        await closeAllTenantPools();
        await closeGlobalPool();
        process.exit(0);
    }
}

migrate();
