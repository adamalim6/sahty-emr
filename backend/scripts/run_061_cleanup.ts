import { globalQuery } from '../db/globalPg';
import { tenantQuery } from '../db/tenantPg';

async function runCleanup() {
    try {
        console.log("Running Cleanup & Re-Migration...");
        const res = await globalQuery('SELECT id FROM public.tenants', []);
        
        for (const row of res) {
            const tenantId = row.id;
            console.log(`Processing tenant: ${tenantId}`);
            
            // 1. Get correct 'poche' UUID
            let pocheId: string | null = null;
            try {
                const uRes = await tenantQuery(tenantId, "SELECT id FROM reference.units WHERE code = 'poche' LIMIT 1");
                if (uRes.length > 0) {
                    pocheId = uRes[0].id;
                    console.log(`  - Found correct 'poche' ID: ${pocheId}`);
                }
            } catch (e: any) {
                console.log(`  - Error getting correct 'poche': ${e.message}`);
                continue;
            }

            if (!pocheId) {
                console.log(`  - Skipping: 'poche' not found in tenant ${tenantId}`);
                continue;
            }
            
            // 2. Point prescriptions to correct UUID
            const updateSql = `
                UPDATE prescriptions
                SET details = jsonb_set(
                                jsonb_set(
                                    jsonb_set(
                                        details - 'unit',
                                        '{unit_id}',
                                        to_jsonb($1::uuid)
                                    ),
                                    '{qty}',
                                    to_jsonb( COALESCE(NULLIF(details->>'qty', '')::numeric, 1) )
                                ),
                                '{blood_product_type}',
                                '"CGR"'::jsonb
                              )
                WHERE prescription_type = 'transfusion'
                  AND details->>'unit' = 'poche(s)';
            `;
            
            try {
                await tenantQuery(tenantId, updateSql, [pocheId]);
                
                // ALSO fix any that were mistakenly updated to the bad POCHE ID (if they already had the update but wrong ID)
                // The newly seeded POCHE id is typically the one with created_at recently, or code 'POCHE'
                const badPocheRes = await tenantQuery(tenantId, "SELECT id FROM reference.units WHERE code = 'POCHE' LIMIT 1");
                if (badPocheRes.length > 0) {
                    const badId = badPocheRes[0].id;
                    await tenantQuery(tenantId, `
                        UPDATE prescriptions 
                        SET details = jsonb_set(details, '{unit_id}', to_jsonb($1::uuid))
                        WHERE prescription_type = 'transfusion' AND details->>'unit_id' = $2
                    `, [pocheId, badId]);
                    
                    // 3. Delete bad POCHE
                    await tenantQuery(tenantId, "DELETE FROM reference.units WHERE id = $1", [badId]);
                    console.log(`  - Fixed prescriptions and deleted bad POCHE unit ${badId}`);
                }
                
                console.log(`  - Re-migration successful for tenant ${tenantId}`);
            } catch (e: any) {
                console.log(`  - Failed to update prescriptions for tenant ${tenantId}: ${e.message}`);
            }
        }
        console.log("Cleanup and Re-Migration completed.");
    } catch (e) {
        console.error("Script failed:", e);
    }
    process.exit(0);
}

runCleanup();
