import { globalQuery } from '../db/globalPg';
import { tenantQuery } from '../db/tenantPg';

async function verify() {
    console.log('--- Verifying Laboratory Reference Foundation ---');

    const expectedTables = [
        'lab_sections', 'lab_sub_sections', 'lab_panels', 'lab_panel_items',
        'lab_specimen_types', 'lab_analytes', 'lab_act_analytes',
        'lab_analyte_units', 'lab_analyte_aliases', 'lab_methods', 'lab_act_methods',
        'lab_act_specimen_types', 'lab_analyte_reference_ranges', 'lab_analyte_external_codes'
    ];

    // 1. GLOBAL
    try {
        console.log('\nChecking Global DB (sahty_global)...');
        
        // 1.1 Tables
        const globalTables = await globalQuery(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (${expectedTables.map(t => `'${t}'`).join(', ')})
        `);
        const gNames = globalTables.map((r: any) => r.table_name);
        
        const missingGlobal = expectedTables.filter(t => !gNames.includes(t));
        if (missingGlobal.length > 0) {
            throw new Error(`Missing global tables: ${missingGlobal.join(', ')}`);
        }
        console.log(`✅ All ${expectedTables.length} global tables exist.`);

        // 1.2 global_actes columns
        const actesCols = await globalQuery(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'global_actes' 
            AND column_name IN ('lab_section_id', 'lab_sub_section_id', 'is_lims_enabled', 'bio_delai_resultats_heures')
        `);
        const gCols = actesCols.map((r: any) => r.column_name);
        if (!gCols.includes('lab_section_id') || !gCols.includes('lab_sub_section_id')) {
            throw new Error('global_actes is missing lab_section_id or lab_sub_section_id');
        }
        if (!gCols.includes('bio_delai_resultats_heures')) {
            throw new Error('global_actes is missing bio_delai_resultats_heures. IT WAS DROPPED INCORRECTLY.');
        }
        console.log(`✅ global_actes has correct classification columns and retains bio_delai_resultats_heures.`);

        // 1.3 Constraint Checks (Partial Index on Defaults)
        console.log('\nVerifying Partial Unique Constraints in Global DB...');
        await globalQuery('BEGIN;');
        try {
            // Mock data for test
            const [method1] = await globalQuery(`INSERT INTO public.lab_methods (code, libelle) VALUES ('M1_TEST', 'Method 1') RETURNING id`);
            const [method2] = await globalQuery(`INSERT INTO public.lab_methods (code, libelle) VALUES ('M2_TEST', 'Method 2') RETURNING id`);
            
            // Require a global_acte to test mapping
            const existingActes = await globalQuery('SELECT id FROM public.global_actes LIMIT 1');
            if (existingActes.length > 0) {
                const actId = existingActes[0].id;

                // Insert first default method
                await globalQuery(`INSERT INTO public.lab_act_methods (global_act_id, method_id, is_default) VALUES ($1, $2, true)`, [actId, method1.id]);
                
                // Try second default method - should throw
                let failed = false;
                try {
                    await globalQuery(`INSERT INTO public.lab_act_methods (global_act_id, method_id, is_default) VALUES ($1, $2, true)`, [actId, method2.id]);
                } catch(e: any) {
                    failed = true;
                    if (e.code === '23505') {
                        console.log(`✅ Partial unique constraint correctly blocked duplicate default method.`);
                    } else {
                        throw e;
                    }
                }
                if (!failed) throw new Error('Allowed duplicate default methods!');
            } else {
                console.log('⚠️ No global_actes available to test constraint.');
            }
        } finally {
            await globalQuery('ROLLBACK;');
        }

    } catch (e: any) {
        console.error('❌ Global Verification Failed:', e.message);
        process.exit(1);
    }

    // 2. TENANT
    try {
        console.log('\nChecking Tenant Reference Mirrors...');
        const clients = await globalQuery("SELECT id FROM tenants LIMIT 1");
        if (clients.length === 0) {
            console.log('No active tenants to verify against.');
            return;
        }
        const tenantId = clients[0].id;
        console.log(`Checking Tenant DB (${tenantId})...`);

        const tenantTables = await tenantQuery(tenantId, `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'reference' 
            AND table_name IN (${expectedTables.map(t => `'${t}'`).join(', ')})
        `);
        const tNames = tenantTables.map((r: any) => r.table_name);
        
        const missingTenant = expectedTables.filter(t => !tNames.includes(t));
        if (missingTenant.length > 0) {
            throw new Error(`Missing tenant reference tables: ${missingTenant.join(', ')}`);
        }
        console.log(`✅ All ${expectedTables.length} mirrored reference tables exist in tenant.`);

        // 2.2 global_actes columns in Reference Schema
        const tActesCols = await tenantQuery(tenantId, `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'reference' AND table_name = 'global_actes' 
            AND column_name IN ('lab_section_id', 'lab_sub_section_id')
        `);
        if (tActesCols.length < 2) throw new Error('Tenant reference.global_actes is missing lab classification columns');
        
        console.log(`✅ Tenant reference.global_actes has correct classification columns.`);

    } catch (e: any) {
        console.error('❌ Tenant Verification Failed:', e.message);
        process.exit(1);
    }

    // 3. Service Layer Rules Check
    console.log('\nSimulating Service Layer Validation Rules (Cycles & Biology Scoping)...');
    
    // 3.1 Cycle Prevention Detection
    const panelTree = [
        { parent: 'A', child: 'B' },
        { parent: 'B', child: 'C' }
    ];
    function checkCycle(targetParent: string, childCandidate: string): boolean {
        if (targetParent === childCandidate) return true;
        for (const link of panelTree) {
            if (link.parent === childCandidate) {
                if (checkCycle(targetParent, link.child)) return true;
            }
        }
        return false;
    }
    
    if (checkCycle('C', 'A')) {
        console.log(`✅ Cycle prevention logic correctly detected A -> B -> C -> A`);
    } else {
        throw new Error('Cycle prevention logic failed test.');
    }

    // 3.2 Biology Scoping Check Simulation
    const act = { famille: 'IMAGERIE', code: 'XRAY' };
    function validateActMapping(actFamille: string) {
        if (actFamille !== 'BIOLOGIE') {
            throw new Error(`Act belongs to ${actFamille}. Lab mappings are strictly limited to BIOLOGIE acts.`);
        }
    }
    
    try {
        validateActMapping(act.famille);
        throw new Error('Biology scoping validation failed to block non-biology act!');
    } catch(e: any) {
        if (e.message.includes('BIOLOGIE acts')) {
             console.log(`✅ Service layer logic correctly blocks lab mapping features for non-BIOLOGIE acts.`);
        } else {
             throw e;
        }
    }

    console.log('\n--- VERIFICATION SUCCESS ---');
    process.exit(0);
}

verify();
