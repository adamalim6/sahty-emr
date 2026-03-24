import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
    user: 'sahty',
    host: 'localhost',
    database: 'sahty_global',
    password: 'sahty_dev_2026',
    port: 5432,
});

async function runSeeding() {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        console.log("==> Starting SECOND PASS SEEDING for lab references...");

        // 1. Ensure Qualitative canonical values exist
        await client.query(`
            INSERT INTO public.lab_canonical_allowed_values (code, label, category, ordinal_rank, actif)
            VALUES 
                ('POSITIVE', 'Positive', 'QUALITATIVE', 1, true),
                ('NEGATIVE', 'Negative', 'QUALITATIVE', 0, true),
                ('TRACE', 'Trace', 'QUALITATIVE', 2, true)
            ON CONFLICT (code) DO NOTHING;
        `);

        // Get their IDs
        const qvRes = await client.query(`SELECT id, code FROM public.lab_canonical_allowed_values WHERE code IN ('POSITIVE', 'NEGATIVE', 'TRACE');`);
        const valueIds: Record<string, string> = {};
        for (const row of qvRes.rows) {
            valueIds[row.code] = row.id;
        }

        // 2. Identify missing contexts
        const missingRes = await client.query(`
            SELECT 
                ac.id as context_id,
                a.libelle as analyte_label,
                u.code as unit_label,
                a.value_type
            FROM public.lab_analyte_contexts ac
            JOIN public.lab_analytes a ON ac.analyte_id = a.id
            LEFT JOIN public.units u ON ac.unit_id = u.id
            LEFT JOIN public.lab_reference_profiles rp ON rp.analyte_context_id = ac.id
            WHERE rp.id IS NULL
        `);

        console.log(`==> Found ${missingRes.rows.length} contexts missing reference profiles.`);

        // For reporting
        let profilesCreated = 0;
        let rulesGenerated = 0;
        const totalMissing = missingRes.rows.length;

        // Count existing for metrics
        const existingRes = await client.query(`SELECT COUNT(DISTINCT analyte_context_id) as c FROM public.lab_reference_profiles`);
        const totalExisting = parseInt(existingRes.rows[0].c, 10);

        for (const context of missingRes.rows) {
            const profileId = uuidv4();

            // Insert Profile
            await client.query(`
                INSERT INTO public.lab_reference_profiles
                (id, analyte_context_id, sex, age_min_days, age_max_days, is_default, source, notes)
                VALUES ($1, $2, 'U', NULL, NULL, true, 'FALLBACK_GENERATED', 'Auto-generated approximate reference profile (non-clinical placeholder)')
            `, [profileId, context.context_id]);
            profilesCreated++;

            if (context.value_type === 'CHOICE' || context.value_type === 'BOOLEAN') {
                // CATEGORICAL rules
                const qRules = [
                    { t: 'NEGATIVE', interp: 'NORMAL', p: 10 },
                    { t: 'POSITIVE', interp: 'ABNORMAL', p: 1 },
                    { t: 'TRACE', interp: 'CAUTION', p: 3 },
                ];
                let order = 1;
                for (const qr of qRules) {
                    await client.query(`
                        INSERT INTO public.lab_reference_rules
                        (id, profile_id, rule_type, interpretation, priority, canonical_value_id, sort_order)
                        VALUES ($1, $2, 'CATEGORICAL', $3, $4, $5, $6)
                    `, [uuidv4(), profileId, qr.interp, qr.p, valueIds[qr.t], order++]);
                    rulesGenerated++;
                }
            } else {
                // NUMERIC rules based on unit
                let X1, X2, X3, X4;
                const unit = context.unit_label?.trim() || '';

                if (unit === 'g/dL') { X1 = 10; X2 = 12; X3 = 16; X4 = 18; }
                else if (unit === 'mg/dL') { X1 = 60; X2 = 70; X3 = 110; X4 = 120; }
                else if (unit === 'mmol/L') { X1 = 3.0; X2 = 3.5; X3 = 5.5; X4 = 6.0; }
                else if (unit === 'U/L') { X1 = 5; X2 = 10; X3 = 40; X4 = 50; }
                else { X1 = 5; X2 = 10; X3 = 80; X4 = 100; }

                const numericRules = [
                    { interp: 'ABNORMAL LOW', lower: null, upper: X1, li: false, ui: false, p: 2, tx: `< ${X1} ${unit}` },
                    { interp: 'CAUTION LOW', lower: X1, upper: X2, li: true, ui: false, p: 3, tx: `${X1} - ${X2} ${unit} (Low)` },
                    { interp: 'NORMAL', lower: X2, upper: X3, li: true, ui: false, p: 10, tx: `${X2} - ${X3} ${unit}` },
                    { interp: 'CAUTION HIGH', lower: X3, upper: X4, li: true, ui: false, p: 3, tx: `${X3} - ${X4} ${unit} (High)` },
                    { interp: 'ABNORMAL HIGH', lower: X4, upper: null, li: true, ui: false, p: 2, tx: `>= ${X4} ${unit}` },
                ];

                let order = 1;
                for (const nr of numericRules) {
                    await client.query(`
                        INSERT INTO public.lab_reference_rules
                        (id, profile_id, rule_type, interpretation, priority, lower_numeric, upper_numeric, lower_inclusive, upper_inclusive, reference_text, sort_order)
                        VALUES ($1, $2, 'NUMERIC_INTERVAL', $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [uuidv4(), profileId, nr.interp, nr.p, nr.lower, nr.upper, nr.li, nr.ui, nr.tx, order++]);
                    rulesGenerated++;
                }
            }
        }

        await client.query('COMMIT');

        console.log("==> Metrics:");
        console.log(`    - Analytes Skipped (already trusted data): ${totalExisting}`);
        console.log(`    - Analytes Processed (fallback generation): ${totalMissing}`);
        console.log(`    - Profiles Created: ${profilesCreated}`);
        console.log(`    - Rules Generated: ${rulesGenerated}`);
        console.log("==> SECOND PASS SEEDING COMPLETE.");

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Fatal error during seeding:", err);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

runSeeding();
