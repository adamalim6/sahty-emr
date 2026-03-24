import { Pool } from 'pg';

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const TENANT_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/ced91ced-fe46-45d1-8ead-b5d51bad5895';

async function verifyGlobal() {
    const globalPool = new Pool({ connectionString: GLOBAL_DB });
    const client = await globalPool.connect();
    let passed = true;

    try {
        console.log("=== Verifying sahty_global ===");

        // 1. Check global_actes defaults
        console.log("-> Checking global_actes metadata...");
        const gc1 = await client.query(`
            SELECT column_name, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'global_actes'
              AND column_name IN ('is_panel', 'billing_mode');
        `);
        
        const isPanelCol = gc1.rows.find(r => r.column_name === 'is_panel');
        const billingCol = gc1.rows.find(r => r.column_name === 'billing_mode');

        if (!isPanelCol || isPanelCol.column_default !== 'false' || isPanelCol.is_nullable !== 'NO') {
            console.error("❌ global_actes.is_panel is missing or incorrectly configured.");
            passed = false;
        } else {
            console.log("✅ global_actes.is_panel configured correctly.");
        }

        if (!billingCol || billingCol.column_default !== "'DECOMPOSED'::text" || billingCol.is_nullable !== 'NO') {
            console.error("❌ global_actes.billing_mode is missing or incorrectly configured.");
            passed = false;
        } else {
            console.log("✅ global_actes.billing_mode configured correctly.");
        }

        // 2. Data Insertion Constraints Check
        console.log("-> Testing insert constraints...");
        
        // Setup dummy references
        const famRes = await client.query(`INSERT INTO public.sih_familles (code, libelle) VALUES ('VD_FAM', 'Verif Fam') ON CONFLICT(code) DO UPDATE SET libelle='Verif Fam' RETURNING id;`);
        const sousFamRes = await client.query(`INSERT INTO public.sih_sous_familles (famille_id, code, libelle) VALUES ('${famRes.rows[0].id}', 'VD_SFAM', 'Verif SubFam') ON CONFLICT(famille_id, code) DO UPDATE SET libelle='Verif SubFam' RETURNING id;`);
        
        // Setup dummy actes
        const act1Res = await client.query(`INSERT INTO public.global_actes (code_sih, libelle_sih, famille_id, sous_famille_id, is_panel) VALUES ('VD_ACT1', 'Verif Act 1', '${famRes.rows[0].id}', '${sousFamRes.rows[0].id}', true) RETURNING id;`);
        const act2Res = await client.query(`INSERT INTO public.global_actes (code_sih, libelle_sih, famille_id, sous_famille_id) VALUES ('VD_ACT2', 'Verif Act 2', '${famRes.rows[0].id}', '${sousFamRes.rows[0].id}') RETURNING id;`);
        
        const act1Id = act1Res.rows[0].id;
        const act2Id = act2Res.rows[0].id;

        // Test missing global_act_id
        try {
            await client.query(`INSERT INTO public.lab_panels (sous_famille_id, code, libelle) VALUES ('${sousFamRes.rows[0].id}', 'VD_PNL_ERR', 'Err Panel');`);
            console.error("❌ INSERT lab_panels without global_act_id succeeded (expected to fail).");
            passed = false;
        } catch (e: any) {
            if (e.message.includes('null value in column "global_act_id"')) {
                console.log("✅ INSERT lab_panels without global_act_id failed as expected.");
            } else {
                console.error("❌ Unexpected error on missing global_act_id:", e.message);
                passed = false;
            }
        }

        // Test uniqueness
        const p1Res = await client.query(`INSERT INTO public.lab_panels (sous_famille_id, code, libelle, global_act_id) VALUES ('${sousFamRes.rows[0].id}', 'VD_PNL1', 'Panel 1', '${act1Id}') RETURNING id;`);
        
        try {
            await client.query(`INSERT INTO public.lab_panels (sous_famille_id, code, libelle, global_act_id) VALUES ('${sousFamRes.rows[0].id}', 'VD_PNL2', 'Panel 2', '${act1Id}') RETURNING id;`);
            console.error("❌ INSERT two lab_panels with SAME global_act_id succeeded (expected to fail).");
            passed = false;
        } catch (e: any) {
            if (e.message.includes('unique constraint') || e.message.includes('Already exists')) {
                console.log("✅ INSERT duplicate global_act_id blocked by UNIQUE constraint.");
            } else {
                console.error("❌ Unexpected error on dup global_act_id:", e.message);
                passed = false;
            }
        }

        // Test strict composition
        try {
            await client.query(`INSERT INTO public.lab_panel_items (panel_id, item_type, child_panel_id) VALUES ('${p1Res.rows[0].id}', 'ACT', '${p1Res.rows[0].id}');`);
            console.error("❌ INSERT ACT item_type with child_panel_id succeeded (expected to fail).");
            passed = false;
        } catch (e: any) {
             if (e.message.includes('chk_lab_panel_child_exclusive')) {
                console.log("✅ INSERT ACT item_type with child_panel_id failed as expected.");
             } else {
                console.error("❌ Unexpected error on ACT + panel_id hybrid:", e.message);
                passed = false;
             }
        }

        try {
            await client.query(`INSERT INTO public.lab_panel_items (panel_id, item_type, child_global_act_id) VALUES ('${p1Res.rows[0].id}', 'PANEL', '${act2Id}');`);
            console.error("❌ INSERT PANEL item_type with child_global_act_id succeeded (expected to fail).");
            passed = false;
        } catch (e: any) {
            if (e.message.includes('chk_lab_panel_child_exclusive')) {
               console.log("✅ INSERT PANEL item_type with child_global_act_id failed as expected.");
            } else {
               console.error("❌ Unexpected error on PANEL + child_act_id hybrid:", e.message);
               passed = false;
            }
        }
        
        // Cleanup dummy
        await client.query(`DELETE FROM public.lab_panels WHERE global_act_id = '${act1Id}'`);
        await client.query(`DELETE FROM public.global_actes WHERE id IN ('${act1Id}', '${act2Id}')`);
        await client.query(`DELETE FROM public.sih_sous_familles WHERE id = '${sousFamRes.rows[0].id}'`);
        await client.query(`DELETE FROM public.sih_familles WHERE id = '${famRes.rows[0].id}'`);

    } finally {
        client.release();
        await globalPool.end();
    }

    return passed;
}

verifyGlobal().then(success => {
    if (success) {
        console.log("\n🚀 Verification logic complete and passed local safety constraints.");
    } else {
        console.log("\n⚠️ Verification logic failed.");
        process.exit(1);
    }
});
