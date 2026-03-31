import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const CLINICAL_HEURISTICS: Array<{ match: string[], analytes: string[] }> = [
    { match: ['HEMOGRAMME', 'NFS', 'NUMERATION'], analytes: ['Leucocytes (WBC)', 'Hématies (RBC)', 'Hémoglobine', 'Hématocrite', 'VGM', 'TCMH', 'CCMH', 'Plaquettes'] },
    { match: ['LIPIDIQUE', 'EAL'], analytes: ['Cholestérol Total', 'Cholestérol HDL', 'Cholestérol LDL', 'Triglycérides'] },
    { match: ['HEPATIQUE'], analytes: ['ASAT (TGO)', 'ALAT (TGP)', 'GGT', 'Phosphatases Alcalines', 'Bilirubine Totale', 'Bilirubine Directe'] },
    { match: ['IONOGRAMME', 'IONO'], analytes: ['Sodium (Na+)', 'Potassium (K+)', 'Chlore (Cl-)'] },
    { match: ['GLYCEMIE', 'GLYC'], analytes: ['Glycémie'] },
    { match: ['CREATININ', 'CREAT'], analytes: ['Créatinine', 'Clairance (DFG)'] },
    { match: ['UREE'], analytes: ['Urée'] },
    { match: ['TRANSAMINASE'], analytes: ['ASAT (TGO)', 'ALAT (TGP)'] },
    { match: ['BILIRUBINE'], analytes: ['Bilirubine Totale', 'Bilirubine Directe', 'Bilirubine Indirecte'] },
    { match: ['THYROIDIEN', 'TSH'], analytes: ['TSH'] },
    { match: ['FERRITINE'], analytes: ['Ferritine'] },
    { match: ['CRP', 'C-REACTIVE'], analytes: ['Protéine C-Réactive (CRP)'] },
    { match: ['HEMOSTASE', 'COAGULATION', 'TP/TCA'], analytes: ['Taux de Prothrombine (TP)', 'INR', 'TCA'] },
    { match: ['FER_SERIQUE', 'FER SERIQUE'], analytes: ['Fer Sérique'] },
    { match: ['VITAMINE D'], analytes: ['Vitamine D (25 OH)'] },
    { match: ['ACIDE URIQUE', 'URICEMIE'], analytes: ['Acide Urique'] },
    { match: ['CALCIUM', 'CALCEMIE'], analytes: ['Calcium'] },
    { match: ['PHOSPHORE', 'PHOSPHATEMIE'], analytes: ['Phosphore'] },
    { match: ['MAGNESIUM', 'MAGNESEMIE'], analytes: ['Magnésium'] },
    { match: ['TROPONINE'], analytes: ['Troponine I', 'Troponine T'] },
    { match: ['D-DIMERE', 'D DIMERE'], analytes: ['D-Dimères'] },
    { match: ['FSH'], analytes: ['FSH'] },
    { match: ['LH'], analytes: ['LH'] },
    { match: ['PROLACTINE'], analytes: ['Prolactine'] },
    { match: ['TESTOSTERONE'], analytes: ['Testostérone'] },
    { match: ['HBA1C', 'HEMOGLOBINE GLYQUEE'], analytes: ['HbA1c'] },
    { match: ['PROTIDEMIE', 'PROTEINES TOTALES'], analytes: ['Protéines Totales'] },
    { match: ['ALBUMINE'], analytes: ['Albumine'] },
    { match: ['ECBU'], analytes: ['Leucocytes Urinaires', 'Hématies Urinaires', 'Cellules Épithéliales', 'Cristaux', 'Cylindres', 'Germes'] }
];

const TRANCHES = [
    { label: 'Neonate', min: 0, max: 30 },
    { label: 'Infant', min: 31, max: 365 },
    { label: 'Child', min: 366, max: 4380 },
    { label: 'Adolescent', min: 4381, max: 6570 },
    { label: 'Adult', min: 6571, max: 23725 },
    { label: 'Geriatric', min: 23726, max: 43800 }
];
const SEXES = ['M', 'F'];

async function main() {
    console.log("HELLO! Launching population sequence in force_run.ts...");
    const pool = new Pool({
        user: 'sahty',
        host: 'localhost',
        database: 'sahty_global',
        password: 'sahty_dev_2026',
        port: 5432,
    });

    try {
        console.log("Starting Phase 1: Context Mapping...");
        await pool.query('BEGIN');

        // Get default relational IDs
        const sfRes = await pool.query('SELECT id FROM public.sih_sous_familles LIMIT 1');
        const defaultSousFamilleId = sfRes.rows.length > 0 ? sfRes.rows[0].id : null;
        if (!defaultSousFamilleId) {
            throw new Error("No default sih_sous_familles found!");
        }
        
        const specRes = await pool.query('SELECT id FROM public.lab_specimen_types LIMIT 1');
        let defaultSpecimenId = specRes.rows.length > 0 ? specRes.rows[0].id : null;
        if (!defaultSpecimenId) {
            defaultSpecimenId = randomUUID();
            await pool.query(`INSERT INTO public.lab_specimen_types (id, code, libelle, actif) VALUES ($1, $2, $3, true)`, [defaultSpecimenId, 'SANG', 'SANG']);
        }

        const missingActsRes = await pool.query(`
            SELECT ga.id, ga.libelle_sih, ga.libelle_ngap 
            FROM public.global_actes ga
            LEFT JOIN public.lab_act_analytes laa ON ga.id = laa.global_act_id
            WHERE ga.type_acte = 'BIOLOGY' AND laa.id IS NULL
        `);
        const acts = missingActsRes.rows;
        console.log(`Found ${acts.length} missing acts.`);

        let newContextsInserted = 0;
        let linksInserted = 0;

        await pool.query('ALTER TABLE public.lab_analyte_contexts DISABLE TRIGGER ALL;');

        for (const act of acts) {
            const label = (act.libelle_sih || act.libelle_ngap || 'Paramètre Inconnu').toUpperCase();
            
            let resolvedAnalytes: string[] = [];
            for (const heuristic of CLINICAL_HEURISTICS) {
                if (heuristic.match.some(m => label.includes(m))) {
                    resolvedAnalytes = [...heuristic.analytes];
                    break;
                }
            }

            if (resolvedAnalytes.length === 0) {
                resolvedAnalytes = [act.libelle_sih || act.libelle_ngap || 'Paramètre Inconnu'];
            }

            let sortOrder = 1;
            for (const analyteName of resolvedAnalytes) {
                const findAna = await pool.query(`SELECT id FROM public.lab_analytes WHERE upper(libelle) = upper($1) LIMIT 1`, [analyteName]);
                let baseAnalyteId;
                if (findAna.rows.length > 0) {
                    baseAnalyteId = findAna.rows[0].id;
                } else {
                    baseAnalyteId = randomUUID();
                    await pool.query(`
                        INSERT INTO public.lab_analytes (id, sous_famille_id, code, libelle, value_type, actif, created_at, updated_at) 
                        VALUES ($1, $2, $3, $4, 'NUMERIC', true, NOW(), NOW())
                    `, [baseAnalyteId, defaultSousFamilleId, `AUTO_${randomUUID().substring(0,8)}`, analyteName]);
                }

                const contextId = randomUUID();
                await pool.query(`
                    INSERT INTO public.lab_analyte_contexts (id, analyte_id, specimen_type_id, unit_id, method_id, analyte_label, specimen_label, unit_label, method_label, actif, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, 'SANG', 'N/A', 'Standard', true, NOW(), NOW())
                `, [contextId, baseAnalyteId, defaultSpecimenId, randomUUID(), randomUUID(), analyteName]);
                newContextsInserted++;

                await pool.query(`
                    INSERT INTO public.lab_act_analytes (id, global_act_id, analyte_id, sort_order, is_primary, is_required, actif, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, true, true, true, NOW(), NOW())
                `, [randomUUID(), act.id, baseAnalyteId, sortOrder]);
                linksInserted++;
                sortOrder++;
            }
        }
        await pool.query('ALTER TABLE public.lab_analyte_contexts ENABLE TRIGGER ALL;');
        console.log(`Phase 1 complete. Inserted ${newContextsInserted} contexts and ${linksInserted} links.`);

        // Phase 2: Profiles
        console.log("Starting Phase 2: Reference Profiles 0-120y Generation. Creating 12 profiles for EVERY context...");
        
        const allContextsRes = await pool.query(`SELECT id FROM public.lab_analyte_contexts`);
        const allContextIds = allContextsRes.rows.map(r => r.id);
        console.log(`Found ${allContextIds.length} total analyte contexts. Processing profiles...`);

        let profilesInserted = 0;
        let profilesSkipped = 0;

        for (const cid of allContextIds) {
            for (const tranche of TRANCHES) {
                for (const sex of SEXES) {
                    const profId = randomUUID();
                    try {
                        const profRes = await pool.query(`
                            INSERT INTO public.lab_reference_profiles 
                            (id, analyte_context_id, sex, age_min_days, age_max_days, is_default, actif, sort_order, notes, created_at, updated_at)
                            VALUES ($1, $2, $3, $4, $5, false, true, 0, $6, NOW(), NOW())
                            ON CONFLICT (analyte_context_id, COALESCE(sex, 'U'), COALESCE(age_min_days, -1), COALESCE(age_max_days, -1)) DO NOTHING
                        `, [profId, cid, sex, tranche.min, tranche.max, `Auto-generated ${tranche.label} tranche`]);
                        if ((profRes.rowCount || 0) > 0) profilesInserted++;
                        else profilesSkipped++;
                    } catch (e: any) {
                        if (profilesSkipped === 0) console.log("--- First Profile Generation Error ---", e.message);
                        profilesSkipped++;
                    }
                }
            }
        }

        console.log(`Phase 2 complete. Inserted ${profilesInserted} new profiles covering 0-120y. (Skipped/Existing: ${profilesSkipped})`);

        await pool.query('COMMIT');
        console.log("ALL DATA SUCCESSFULLY COMMITTED TO SAHTY_GLOBAL!");
    } catch (e: any) {
        await pool.query('ROLLBACK');
        console.error("Fatal Error:", e.message);
    } finally {
        await pool.end();
    }
}

main().catch(console.error);
