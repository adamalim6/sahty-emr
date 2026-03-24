import { Pool } from 'pg';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

async function run() {
    const pool = new Pool({
        user: 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        database: 'sahty_global'
    });
    
    try {
        await pool.query('BEGIN');
        
        console.log("=== STEP 1: SEEDING CANONICAL VALUES ===");
        const canonicals = [
            { code: 'POSITIVE', label: 'Positif', category: 'binary', rank: 100 },
            { code: 'NEGATIVE', label: 'Négatif', category: 'binary', rank: 10 },
            { code: 'REACTIVE', label: 'Réactif', category: 'binary', rank: 100 },
            { code: 'NON_REACTIVE', label: 'Non réactif', category: 'binary', rank: 10 },
            { code: 'TRACE', label: 'Traces', category: 'semi-quantitative', rank: 50 },
            { code: 'ABSENT', label: 'Absent', category: 'binary', rank: 10 },
            { code: 'PRESENT', label: 'Présent', category: 'binary', rank: 100 },
            { code: 'NORMAL', label: 'Normal', category: 'interpretation', rank: 10 },
            { code: 'ABNORMAL', label: 'Anormal', category: 'interpretation', rank: 100 }
        ];
        
        const canonicalIds: Record<string, string> = {};
        for (const c of canonicals) {
            const id = uuidv4();
            await pool.query(`
                INSERT INTO public.lab_canonical_allowed_values (id, code, label, category, ordinal_rank, actif)
                VALUES ($1, $2, $3, $4, $5, true)
                ON CONFLICT (code) DO NOTHING
            `, [id, c.code, c.label, c.category, c.rank]);
            
            const existing = await pool.query('SELECT id FROM public.lab_canonical_allowed_values WHERE code = $1', [c.code]);
            canonicalIds[c.code] = existing.rows[0].id;
        }
        console.log(`Inserted / Confirmed ${canonicals.length} canonical values.`);

        console.log("=== STEP 2 & 3: SEEDING PROFILES & RULES ===");
        const analytes = JSON.parse(fs.readFileSync('analytes.json', 'utf-8'));
        
        const clinicalDb: Record<string, any> = {
            'sodium': { type: 'numeric', sex: 'U', min: 135, max: 145, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'potassium': { type: 'numeric', sex: 'U', min: 3.5, max: 5.1, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'chlorure': { type: 'numeric', sex: 'U', min: 98, max: 107, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'calcium': { type: 'numeric', sex: 'U', min: 2.15, max: 2.50, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'magnésium': { type: 'numeric', sex: 'U', min: 0.70, max: 1.05, source: 'NHS Guidelines', notes: 'Adult reference range' },
            'phosphore': { type: 'numeric', sex: 'U', min: 0.81, max: 1.45, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'urée': { type: 'numeric', sex: 'U', min: 2.5, max: 7.1, source: 'NHS Guidelines', notes: 'Adult reference range' },
            'créatinine': { 
                type: 'numeric_split', 
                source: 'Mayo Clinic', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 62, max: 106 },
                    { sex: 'F', min: 44, max: 80 }
                ]
            },
            'clairance de la créatinine': { type: 'numeric', sex: 'U', min: 90, max: 140, source: 'NHS Guidelines', notes: 'Adult reference range' },
            'glucose': { type: 'numeric', sex: 'U', min: 3.9, max: 5.5, source: 'WHO Guidelines', notes: 'Fasting Adult reference range' },
            'glycémie': { type: 'numeric', sex: 'U', min: 3.9, max: 5.5, source: 'WHO Guidelines', notes: 'Fasting Adult reference range' },
            'hémoglobine glyquée': { type: 'numeric', sex: 'U', min: 4.0, max: 5.7, source: 'American Diabetes Association', notes: 'Normal reference limit' },
            'protéines totales': { type: 'numeric', sex: 'U', min: 60, max: 80, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'albumine': { type: 'numeric', sex: 'U', min: 35, max: 50, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'bilirubine totale': { type: 'numeric', sex: 'U', min: 0, max: 21, source: 'NHS Guidelines', notes: 'Adult reference range' },
            'bilirubine directe': { type: 'numeric', sex: 'U', min: 0, max: 5, source: 'NHS Guidelines', notes: 'Adult reference range' },
            'asat': { type: 'numeric', sex: 'U', min: 0, max: 40, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'alat': { type: 'numeric', sex: 'U', min: 0, max: 41, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'gamma-gt': { 
                type: 'numeric_split', source: 'Mayo Clinic', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 10, max: 71 },
                    { sex: 'F', min: 6, max: 42 }
                ]
            },
            'phosphatases alcalines': { type: 'numeric', sex: 'U', min: 40, max: 129, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'acide urique': { 
                type: 'numeric_split', source: 'NHS Guidelines', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 240, max: 420 },
                    { sex: 'F', min: 140, max: 340 }
                ]
            },
            'cholestérol total': { type: 'numeric', sex: 'U', min: 0, max: 5.2, source: 'American Heart Association', notes: 'Desirable limit' },
            'cholestérol hdl': { 
                type: 'numeric_split', source: 'American Heart Association', notes: 'Desirable limit',
                profiles: [
                    { sex: 'M', min: 1.0, max: 5.0 },
                    { sex: 'F', min: 1.3, max: 5.0 }
                ]
            },
            'cholestérol ldl': { type: 'numeric', sex: 'U', min: 0, max: 3.0, source: 'American Heart Association', notes: 'Desirable limit' },
            'triglycérides': { type: 'numeric', sex: 'U', min: 0, max: 1.7, source: 'American Heart Association', notes: 'Desirable limit' },
            'fer sérique': { 
                type: 'numeric_split', source: 'Mayo Clinic', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 11, max: 28 },
                    { sex: 'F', min: 9, max: 26 }
                ]
            },
            'ferritine': { 
                type: 'numeric_split', source: 'Mayo Clinic', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 20, max: 250 },
                    { sex: 'F', min: 10, max: 120 }
                ]
            },
            'transferrine': { type: 'numeric', sex: 'U', min: 2.0, max: 3.6, source: 'Mayo Clinic', notes: 'Adult reference range' },
            'crp': { type: 'numeric', sex: 'U', min: 0, max: 5.0, source: 'NHS Guidelines', notes: 'Adult reference range' },
            'hématies': { 
                type: 'numeric_split', source: 'WHO Guidelines', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 4.5, max: 5.9 },
                    { sex: 'F', min: 4.0, max: 5.2 }
                ]
            },
            'hémoglobine': { 
                type: 'numeric_split', source: 'WHO Guidelines', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 13.0, max: 17.0 },
                    { sex: 'F', min: 12.0, max: 15.0 }
                ]
            },
            'hématocrite': { 
                type: 'numeric_split', source: 'WHO Guidelines', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 40, max: 52 },
                    { sex: 'F', min: 36, max: 48 }
                ]
            },
            'volume globulaire moyen': { type: 'numeric', sex: 'U', min: 80, max: 100, source: 'WHO Guidelines', notes: 'Adult reference range' },
            'leucocytes': { type: 'numeric', sex: 'U', min: 4.0, max: 10.0, source: 'WHO Guidelines', notes: 'Adult reference range' },
            'plaquettes': { type: 'numeric', sex: 'U', min: 150, max: 450, source: 'WHO Guidelines', notes: 'Adult reference range' },
            'vitesse de sédimentation': { 
                type: 'numeric_split', source: 'Mayo Clinic', notes: 'Adult reference range',
                profiles: [
                    { sex: 'M', min: 0, max: 15 },
                    { sex: 'F', min: 0, max: 20 }
                ]
            },
            'tsh': { type: 'numeric', sex: 'U', min: 0.4, max: 4.0, source: 'American Thyroid Association', notes: 'Adult reference range' },
            't4 libre': { type: 'numeric', sex: 'U', min: 12, max: 22, source: 'American Thyroid Association', notes: 'Adult reference range' },
            't3 libre': { type: 'numeric', sex: 'U', min: 3.1, max: 6.8, source: 'American Thyroid Association', notes: 'Adult reference range' },
            'Psa total': { type: 'numeric', sex: 'M', min: 0, max: 4.0, source: 'American Cancer Society', notes: 'Adult male reference range' },
            
            // Qualitatives
            'sérologie': { type: 'qualitative', canonical: 'NEGATIVE', interpretation: 'NORMAL', source: 'CDC Guidelines', notes: 'Standard screening expectation' },
            'anticorps': { type: 'qualitative', canonical: 'NEGATIVE', interpretation: 'NORMAL', source: 'WHO Guidelines', notes: 'Standard screening expectation' },
            'recherche': { type: 'qualitative', canonical: 'ABSENT', interpretation: 'NORMAL', source: 'Generic Clinical Standard', notes: 'Standard screening expectation' },
            'ag hbs': { type: 'qualitative', canonical: 'NEGATIVE', interpretation: 'NORMAL', source: 'CDC Guidelines', notes: 'Hepatitis screening expectation' },
            'vih': { type: 'qualitative', canonical: 'NEGATIVE', interpretation: 'NORMAL', source: 'CDC Guidelines', notes: 'HIV screening expectation' },
            'hcv': { type: 'qualitative', canonical: 'NEGATIVE', interpretation: 'NORMAL', source: 'CDC Guidelines', notes: 'HCV screening expectation' }
        };

        let seededCount = 0;
        let skippedCount = 0;

        for (const ana of analytes) {
            const lowLabel = ana.analyte_label.toLowerCase();
            
            // Identify match by word boundaries or exact containment
            let matchKey = null;
            for (const key of Object.keys(clinicalDb)) {
                if (lowLabel.includes(key)) {
                    matchKey = key;
                    break;
                }
            }

            if (!matchKey) {
                skippedCount++;
                continue;
            }

            const ruleDef = clinicalDb[matchKey];
            
            // Check if profile exists
            const existCheck = await pool.query('SELECT id FROM public.lab_reference_profiles WHERE analyte_context_id = $1', [ana.id]);
            if (existCheck.rows.length > 0) continue; 

            seededCount++;
            
            const insertProfile = async (sex: string, minAge: number, maxAge: number) => {
                const profileId = uuidv4();
                await pool.query(`
                    INSERT INTO public.lab_reference_profiles 
                    (id, analyte_context_id, sex, age_min_days, age_max_days, is_default, actif, source, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
                `, [profileId, ana.id, sex, minAge, maxAge, true, ruleDef.source, ruleDef.notes]);
                return profileId;
            };

            const insertNumericRule = async (profileId: string, min: number, max: number) => {
                const ruleId = uuidv4();
                await pool.query(`
                    INSERT INTO public.lab_reference_rules
                    (id, profile_id, rule_type, interpretation, priority, lower_numeric, upper_numeric, lower_inclusive, upper_inclusive, reference_text, actif)
                    VALUES ($1, $2, 'NUMERIC_INTERVAL', 'NORMAL', 10, $3, $4, true, true, $5, true)
                `, [ruleId, profileId, min, max, (min + ' - ' + max + ' ' + (ana.unit_label || '')).trim()]);
            };

            const insertQualitativeRule = async (profileId: string, canonicalCode: string, interpretation: string) => {
                const ruleId = uuidv4();
                await pool.query(`
                    INSERT INTO public.lab_reference_rules
                    (id, profile_id, rule_type, interpretation, priority, canonical_value_id, actif)
                    VALUES ($1, $2, 'CATEGORICAL', $3, 10, $4, true)
                `, [ruleId, profileId, interpretation, canonicalIds[canonicalCode]]);
            };

            if (ruleDef.type === 'numeric') {
                const profileId = await insertProfile(ruleDef.sex, 0, 36500);
                await insertNumericRule(profileId, ruleDef.min, ruleDef.max);
            } else if (ruleDef.type === 'numeric_split') {
                for (const p of ruleDef.profiles) {
                    const profileId = await insertProfile(p.sex, 0, 36500);
                    await insertNumericRule(profileId, p.min, p.max);
                }
            } else if (ruleDef.type === 'qualitative') {
                const profileId = await insertProfile('U', 0, 36500);
                await insertQualitativeRule(profileId, ruleDef.canonical, ruleDef.interpretation);
            }
        }
        
        await pool.query('COMMIT');
        console.log('Successfully seeded ' + seededCount + ' analytes. Skipped ' + skippedCount + ' (no mapping).');

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
