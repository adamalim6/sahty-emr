import { globalQuery } from '../db/globalPg';
import { tenantQuery } from '../db/tenantPg';

async function runMigration() {
    try {
        console.log("Executing Migration 061 (Transfusion Refactor) across all tenants...");
        const res = await globalQuery('SELECT id FROM public.tenants', []);
        
        for (const row of res) {
            const tenantId = row.id;
            console.log(`Processing tenant: ${tenantId}`);
            
            // 1. Get POCHE UUID
            let pocheId: string | null = null;
            try {
                const uRes = await tenantQuery(tenantId, "SELECT id FROM reference.units WHERE code = 'POCHE' LIMIT 1");
                if (uRes.length > 0) {
                    pocheId = uRes[0].id;
                } else {
                    // Seed POCHE
                    const insertRes = await tenantQuery(tenantId, `
                        INSERT INTO reference.units (code, display, is_ucum, is_active, sort_order)
                        VALUES ('POCHE', 'poche(s)', false, true, 500)
                        RETURNING id
                    `);
                    pocheId = insertRes[0].id;
                    console.log(`  - Seeded POCHE unit with ID: ${pocheId}`);
                }
            } catch (e: any) {
                console.log(`  - Error getting/seeding POCHE in tenant ${tenantId}: ${e.message}`);
                continue;
            }
            
            if (!pocheId) {
                console.log(`  - POCHE unit not found for tenant ${tenantId}. Skipping.`);
                continue;
            }
            
            // 2. Update prescriptions
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
                const updateRes = await tenantQuery(tenantId, updateSql, [pocheId]);
                // tenantQuery might return an array of rows, not a raw pg Result object with rowCount depending on implementation
                console.log(`  - Successfully ran update for tenant ${tenantId}`);
            } catch (e: any) {
                console.log(`  - Failed to update prescriptions for tenant ${tenantId}: ${e.message}`);
            }
        }
        
        console.log("Migration completed.");
    } catch (e) {
        console.error("Migration failed:", e);
    }
    process.exit(0);
}

runMigration();
