import { globalQuery } from '../db/globalPg';

/**
 * seed_lab_reference_foundation.ts
 * 
 * Seed Strategy Guidance:
 * - Chapters: These are already defined in the existing `sih_sous_familles` table under the 'BIOLOGIE' family.
 *   DO NOT SEED CHAPTERS HERE. Query `sih_sous_familles` where `famille_id` points to 'BIOLOGIE' to get the chapter UUIDs.
 * 
 * - Sections & Sub-Sections: 
 *   These build the fixed taxonomy below chapters (e.g. "Electrolytes" under "Biochimie").
 * 
 * - Specimen Types, Units, Methods:
 *   These are global catalogs. Once seeded here, they propagate to tenants via reference schema mirroring.
 */

async function seed() {
    console.log('--- Seeding Laboratory Reference Foundation ---');
    try {
        await globalQuery('BEGIN;');

        // 1. Seed Specimen Types
        const specimens = [
            { code: 'WHOLE_BLOOD', libelle: 'Sang total' },
            { code: 'SERUM', libelle: 'Sérum' },
            { code: 'PLASMA', libelle: 'Plasma' },
            { code: 'URINE', libelle: 'Urine' },
            { code: 'STOOL', libelle: 'Selles' },
            { code: 'CSF', libelle: 'Liquide céphalo-rachidien (LCR)' },
            { code: 'SWAB', libelle: 'Écouvillon' }
        ];

        console.log('Seeding Specimen Types...');
        for (const spec of specimens) {
            await globalQuery(`
                INSERT INTO public.lab_specimen_types (code, libelle)
                VALUES ($1, $2)
                ON CONFLICT (code) DO NOTHING
            `, [spec.code, spec.libelle]);
        }

        // 2. Seed Common Units
        const units = [
            { code: 'G_DL', symbole: 'g/dL', libelle: 'Grammes par décilitre' },
            { code: 'MMOL_L', symbole: 'mmol/L', libelle: 'Millimoles par litre' },
            { code: 'MG_L', symbole: 'mg/L', libelle: 'Milligrammes par litre' },
            { code: 'PERCENT', symbole: '%', libelle: 'Pourcentage' },
            { code: 'K_UL', symbole: '10^3/uL', libelle: 'Milliers par microlitre' },
            { code: 'U_L', symbole: 'U/L', libelle: 'Unités par litre' }
        ];

        console.log('Seeding Units...');
        for (const unit of units) {
            await globalQuery(`
                INSERT INTO public.units (code, display, sort_order)
                VALUES ($1, $2, 0)
                ON CONFLICT (code) DO NOTHING
            `, [unit.code, unit.libelle]);
        }

        // 3. Seed Common Methods
        const methods = [
            { code: 'SPECTRO', libelle: 'Spectrophotométrie' },
            { code: 'IMMUNOTURB', libelle: 'Immunoturbidimétrie' },
            { code: 'ELISA', libelle: 'ELISA' },
            { code: 'PCR', libelle: 'PCR' },
            { code: 'MICROSCOPY', libelle: 'Microscopie manuelle' }
        ];

        console.log('Seeding Methods...');
        for (const method of methods) {
            await globalQuery(`
                INSERT INTO public.lab_methods (code, libelle)
                VALUES ($1, $2)
                ON CONFLICT (code) DO NOTHING
            `, [method.code, method.libelle]);
        }

        // 4. Initial Sections / Sub-Sections Guidance
        console.log('Scanning for BIOLOGIE chapters to seed initial sections...');
        
        // Find the BIOLOGIE family
        const familles = await globalQuery(`SELECT id FROM public.sih_familles WHERE code = 'BIOLOGIE'`);
        if (familles.length > 0) {
            const bioFamilleId = familles[0].id;
            
            // Find Chapters (Sous-familles)
            const chapters = await globalQuery(`SELECT id, code, libelle FROM public.sih_sous_familles WHERE famille_id = $1`, [bioFamilleId]);
            
            const biochimieChapter = chapters.find((c: any) => c.code === 'BIOCH' || c.libelle.toLowerCase().includes('biochimie'));
            const hematoChapter = chapters.find((c: any) => c.code === 'HEMAT' || c.libelle.toLowerCase().includes('hématologie'));

            if (biochimieChapter) {
                console.log(`Seeding Sections for Biochimie (${biochimieChapter.libelle})...`);
                // Insert Section: Electrolytes
                const [sectRes] = await globalQuery(`
                    INSERT INTO public.lab_sections (sous_famille_id, code, libelle)
                    VALUES ($1, 'ELECTRO', 'Électrolytes')
                    ON CONFLICT (sous_famille_id, code) DO UPDATE SET libelle = EXCLUDED.libelle
                    RETURNING id
                `, [biochimieChapter.id]);

                // Insert Sub-Section: Serum Electrolytes
                await globalQuery(`
                    INSERT INTO public.lab_sub_sections (section_id, code, libelle)
                    VALUES ($1, 'SERUM_ELEC', 'Électrolytes Sériques')
                    ON CONFLICT (section_id, code) DO NOTHING
                `, [sectRes.id]);
            }
            
            if (hematoChapter) {
                console.log(`Seeding Sections for Hématologie (${hematoChapter.libelle})...`);
                await globalQuery(`
                    INSERT INTO public.lab_sections (sous_famille_id, code, libelle)
                    VALUES ($1, 'RBC_STUDY', 'Études des globules rouges')
                    ON CONFLICT (sous_famille_id, code) DO NOTHING
                `, [hematoChapter.id]);
            }
        } else {
            console.log('BIOLOGIE family not found in sih_familles. Skipping section seeding.');
        }

        await globalQuery('COMMIT;');
        console.log('--- Seeding Complete ---');
    } catch (e: any) {
        await globalQuery('ROLLBACK;');
        console.error('Seeding failed:', e.message);
        process.exit(1);
    }
    process.exit(0);
}

seed();
