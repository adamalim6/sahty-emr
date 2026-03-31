import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({
    user: 'sahty',
    password: 'sahty_dev_2026',
    database: 'sahty_global',
    port: 5432
});

const CLINICAL_HEURISTICS: Record<string, {
    M?: { min: number, max: number },
    F?: { min: number, max: number },
    ANY?: { min: number, max: number }
}> = {
    'HEMOGLOBINE': { M: { min: 13.8, max: 17.2 }, F: { min: 12.1, max: 15.1 } },
    'GLYCEMIE': { ANY: { min: 0.7, max: 1.1 } },
    'CREATININE': { M: { min: 7.0, max: 12.0 }, F: { min: 5.0, max: 9.0 } },
    'SODIUM': { ANY: { min: 135, max: 145 } },
    'POTASSIUM': { ANY: { min: 3.5, max: 5.0 } },
    'CALCIUM': { ANY: { min: 8.5, max: 10.5 } },
    'CHOLESTEROL': { ANY: { min: 0, max: 2.0 } },
    'TRIGLYCERIDES': { ANY: { min: 0, max: 1.5 } },
    'LEUCOCYTES': { ANY: { min: 4.0, max: 11.0 } },
    'PLAQUETTES': { ANY: { min: 150, max: 450 } },
    'CRP': { ANY: { min: 0, max: 5.0 } },
    'AST': { ANY: { min: 8, max: 48 } },
    'ALT': { ANY: { min: 7, max: 55 } },
    'FERRITINE': { M: { min: 24, max: 336 }, F: { min: 11, max: 307 } }
};

function getHeuristic(label: string, sex: string | null): { min: number, max: number } | null {
    const l = label.toUpperCase();
    for (const [key, rules] of Object.entries(CLINICAL_HEURISTICS)) {
        if (l.includes(key)) {
            if (sex === 'M' && rules.M) return rules.M;
            if (sex === 'F' && rules.F) return rules.F;
            if (rules.ANY) return rules.ANY;
            // Fallback to M if exact sex mapping exists but missing (e.g. U mapping to M for bounds)
            return rules.M || rules.F || null;
        }
    }
    return null;
}

async function run() {
    console.log("HELLO! Launching reference rules sequence...");
    await pool.query('BEGIN;');

    try {
        // Fetch all profiles and their base analyte details to determine value_type and heuristic
        const profilesRes = await pool.query(`
            SELECT p.id as profile_id, p.sex, a.libelle, a.value_type 
            FROM public.lab_reference_profiles p
            JOIN public.lab_analyte_contexts c ON p.analyte_context_id = c.id
            JOIN public.lab_analytes a ON c.analyte_id = a.id
        `);

        console.log(`Found ${profilesRes.rows.length} reference profiles. Processing bounds...`);

        let rulesInserted = 0;
        let rulesSkipped = 0;

        for (const row of profilesRes.rows) {
            const { profile_id, sex, libelle, value_type } = row;

            if (value_type === 'NUMERIC') {
                const norm = getHeuristic(libelle, sex) || { min: 0, max: 100 }; // Placeholder fallback
                
                // Construct parameters for Normal, Low, High
                const inserts = [
                    // NORMAL [min, max]
                    [randomUUID(), profile_id, 'NUMERIC_INTERVAL', 'NORMAL', 10, norm.min, norm.max, true, true],
                    // ABNORMAL LOW (null, min) 
                    [randomUUID(), profile_id, 'NUMERIC_INTERVAL', 'ABNORMAL LOW', 20, null, norm.min, false, false],
                    // ABNORMAL HIGH (max, null)
                    [randomUUID(), profile_id, 'NUMERIC_INTERVAL', 'ABNORMAL HIGH', 30, norm.max, null, false, false]
                ];

                for (const ins of inserts) {
                    try {
                        const r = await pool.query(`
                            INSERT INTO public.lab_reference_rules 
                            (id, profile_id, rule_type, interpretation, priority, lower_numeric, upper_numeric, lower_inclusive, upper_inclusive, actif)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                        `, ins);
                        if (r.rowCount) rulesInserted++;
                    } catch (e: any) {
                        // Conflict or gist exclusions
                        if (rulesSkipped === 0) console.log("--- First Rules Error ---", e.message);
                        rulesSkipped++;
                    }
                }
            } else {
                // CATEGORICAL/TEXT/BOOLEAN Fallback
                const inserts = [
                    [randomUUID(), profile_id, 'CATEGORICAL', 'NORMAL', 10, 'Négatif'],
                    [randomUUID(), profile_id, 'CATEGORICAL', 'ABNORMAL', 20, 'Positif']
                ];
                for (const ins of inserts) {
                    try {
                        const r = await pool.query(`
                            INSERT INTO public.lab_reference_rules 
                            (id, profile_id, rule_type, interpretation, priority, display_text, actif)
                            VALUES ($1, $2, $3, $4, $5, $6, true)
                        `, ins);
                        if (r.rowCount) rulesInserted++;
                    } catch (e: any) {
                        if (rulesSkipped === 0) console.log("--- First Rules Error ---", e.message);
                        rulesSkipped++;
                    }
                }
            }
        }

        console.log(`Rules sequence complete. Inserted ${rulesInserted} limits. (Skipped/Existing: ${rulesSkipped})`);
        await pool.query('COMMIT;');
        console.log("RULES SUCCESSFULLY COMMITTED TO SAHTY_GLOBAL!");
    } catch (e) {
        await pool.query('ROLLBACK;');
        console.error("Fatal Error...", e);
    } finally {
        pool.end();
    }
}

run();
