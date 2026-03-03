import { getGlobalPool } from '../db/globalPg';

const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000001';

function normalizeCode(label: string): string {
    return label
        .trim()
        .normalize('NFD') // splits accented characters
        .replace(/[\u0300-\u036f]/g, '') // removes diacritics
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function runBackfill() {
    console.log("--- Starting Taxonomy Backfill ---");
    const globalPool = getGlobalPool();
    const globalClient = await globalPool.connect();
    
    try {
        await globalClient.query('BEGIN');
        
        await globalClient.query(`SET LOCAL app.user_id = '${SYSTEM_ACTOR}'`);

        // 1. Load existing families (libelle -> id mapping)
        const famRes = await globalClient.query(`SELECT id, code, libelle FROM public.sih_familles`);
        const existingFams = famRes.rows;
        
        // key: lower(libelle)
        const famLibelleMap = new Map<string, string>();
        const famCodeSet = new Set<string>();
        for (const f of existingFams) {
            famLibelleMap.set(f.libelle.trim().toLowerCase(), f.id);
            famCodeSet.add(f.code.toUpperCase());
        }

        // STEP 1: Missing Families
        console.log("-> Step 1: Missing Families");
        const missingFamsRes = await globalClient.query(`
            SELECT DISTINCT famille_sih 
            FROM public.global_actes 
            WHERE famille_sih IS NOT NULL AND TRIM(famille_sih) != ''
        `);

        let insertedFamilies = 0;
        for (const row of missingFamsRes.rows) {
            const label = row.famille_sih.trim();
            const lowerLabel = label.toLowerCase();
            
            if (!famLibelleMap.has(lowerLabel)) {
                let baseCode = normalizeCode(label);
                let code = baseCode;
                let counter = 2;
                while (famCodeSet.has(code)) {
                    code = `${baseCode}_${counter}`;
                    counter++;
                }
                
                // Insert
                const ins = await globalClient.query(`
                    INSERT INTO public.sih_familles (code, libelle)
                    VALUES ($1, $2) RETURNING id
                `, [code, label]);
                
                famCodeSet.add(code);
                famLibelleMap.set(lowerLabel, ins.rows[0].id);
                insertedFamilies++;
            }
        }
        console.log(`Inserted ${insertedFamilies} new families.`);

        // STEP 2: Missing Sub-Families
        console.log("-> Step 2: Missing Sub-Families");
        const sfRes = await globalClient.query(`SELECT id, famille_id, code, libelle FROM public.sih_sous_familles`);
        const existingSubFams = sfRes.rows;
        
        // Map: famille_id_lower(libelle) -> id
        const subFamLibelleMap = new Map<string, string>();
        const subFamCodeSet = new Set<string>(); // famille_id_code
        for (const sf of existingSubFams) {
            subFamLibelleMap.set(`${sf.famille_id}_${sf.libelle.trim().toLowerCase()}`, sf.id);
            subFamCodeSet.add(`${sf.famille_id}_${sf.code.toUpperCase()}`);
        }

        const missingSubFamsRes = await globalClient.query(`
            SELECT DISTINCT famille_sih, sous_famille_sih
            FROM public.global_actes 
            WHERE famille_sih IS NOT NULL AND TRIM(famille_sih) != ''
              AND sous_famille_sih IS NOT NULL AND TRIM(sous_famille_sih) != ''
        `);

        let insertedSubFamilies = 0;
        for (const row of missingSubFamsRes.rows) {
            const famLabel = row.famille_sih.trim().toLowerCase();
            const sfLabel = row.sous_famille_sih.trim();
            const lowerSfLabel = sfLabel.toLowerCase();
            
            const famId = famLibelleMap.get(famLabel);
            if (!famId) {
                console.warn(`WARNING: Famille ID not found for label: ${famLabel}`);
                continue;
            }

            const mapKey = `${famId}_${lowerSfLabel}`;
            if (!subFamLibelleMap.has(mapKey)) {
                let baseCode = normalizeCode(sfLabel);
                let code = baseCode;
                let counter = 2;
                
                while (subFamCodeSet.has(`${famId}_${code}`)) {
                    code = `${baseCode}_${counter}`;
                    counter++;
                }

                const ins = await globalClient.query(`
                    INSERT INTO public.sih_sous_familles (famille_id, code, libelle)
                    VALUES ($1, $2, $3) RETURNING id
                `, [famId, code, sfLabel]);

                subFamCodeSet.add(`${famId}_${code}`);
                subFamLibelleMap.set(mapKey, ins.rows[0].id);
                insertedSubFamilies++;
            }
        }
        console.log(`Inserted ${insertedSubFamilies} new sub-families.`);

        // STEP 3 & 4: Backfill global_actes
        console.log("-> Step 3 & 4: Backfilling Acts (UPDATE)");
        
        const actsToBackfill = await globalClient.query(`
            SELECT id, famille_sih, sous_famille_sih, famille_id, sous_famille_id 
            FROM public.global_actes
            WHERE (famille_sih IS NOT NULL AND famille_id IS NULL)
               OR (sous_famille_sih IS NOT NULL AND sous_famille_id IS NULL)
        `);
        console.log(`Found ${actsToBackfill.rows.length} acts to process.`);

        let updatedFamIds = 0;
        let updatedSubFamIds = 0;

        for (const act of actsToBackfill.rows) {
            let newFamId = act.famille_id;
            let newSubFamId = act.sous_famille_id;
            let needsUpdate = false;

            if (act.famille_sih && !newFamId) {
                const fId = famLibelleMap.get(act.famille_sih.trim().toLowerCase());
                if (fId) {
                    newFamId = fId;
                    updatedFamIds++;
                    needsUpdate = true;
                }
            }

            if (act.sous_famille_sih && !newSubFamId && newFamId) {
                const sfId = subFamLibelleMap.get(`${newFamId}_${act.sous_famille_sih.trim().toLowerCase()}`);
                if (sfId) {
                    newSubFamId = sfId;
                    updatedSubFamIds++;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await globalClient.query(`
                    UPDATE public.global_actes 
                    SET famille_id = $1, sous_famille_id = $2 
                    WHERE id = $3
                `, [newFamId, newSubFamId, act.id]);
            }
        }
        console.log(`Updated NULL famille_ids: ${updatedFamIds}`);
        console.log(`Updated NULL sous_famille_ids: ${updatedSubFamIds}`);

        await globalClient.query('COMMIT');
        
        // VALIDATION QUERIES
        console.log("\n-> Step 5: Post-Backfill Validation");
        
        const nullFamCount = await globalClient.query(`
            SELECT COUNT(*) as c FROM public.global_actes 
            WHERE famille_sih IS NOT NULL AND TRIM(famille_sih) != '' AND famille_id IS NULL
        `);
        console.log(`Acts with famille_sih but NULL famille_id: ${nullFamCount.rows[0].c}`);

        const nullSubFamCount = await globalClient.query(`
            SELECT COUNT(*) as c FROM public.global_actes 
            WHERE sous_famille_sih IS NOT NULL AND TRIM(sous_famille_sih) != '' AND sous_famille_id IS NULL
        `);
        console.log(`Acts with sous_famille_sih but NULL sous_famille_id: ${nullSubFamCount.rows[0].c}`);
        
    } catch (e) {
        await globalClient.query('ROLLBACK');
        console.error("❌ Backfill failed:", e);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}

runBackfill().catch(console.error);
