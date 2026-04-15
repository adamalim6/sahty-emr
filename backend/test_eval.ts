import { Pool } from 'pg';
import { ReferenceEvaluationEngine } from './services/ReferenceEvaluationEngine';

// Hardcoded connect to one of the tenants
const pool = new Pool({
    connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_00000000-0000-4000-a000-000000000001'
});

async function main() {
    const client = await pool.connect();
    try {
        console.log("Fetching a random lab_analyte_context_id that has rules...");
        const ctxRes = await client.query(`
            SELECT p.analyte_context_id, p.id as profile_id, r.lower_numeric, r.upper_numeric 
            FROM lab_reference_rules r
            JOIN lab_reference_profiles p ON p.id = r.profile_id
            WHERE r.interpretation = 'NORMAL' AND r.lower_numeric IS NOT NULL AND r.upper_numeric IS NOT NULL
            LIMIT 1
        `);
        
        if (ctxRes.rows.length === 0) {
            console.log("No rules found!");
            return;
        }

        const { analyte_context_id, lower_numeric, upper_numeric } = ctxRes.rows[0];
        console.log(`Found context: ${analyte_context_id}`);
        console.log(`Normal range: ${lower_numeric} - ${upper_numeric}`);

        const engine = new ReferenceEvaluationEngine();

        // Test normal value
        const valNormal = parseFloat(lower_numeric) + ((parseFloat(upper_numeric) - parseFloat(lower_numeric)) / 2);
        const resNormal = await engine.evaluate(client, {
            analyte_context_id,
            numeric_value: valNormal,
            patient_sex: 'M',
            patient_age_days: 10000
        });
        console.log("Evaluation (NORMAL expected):", resNormal);

        // Test high value
        const valHigh = parseFloat(upper_numeric) + 10;
        const resHigh = await engine.evaluate(client, {
            analyte_context_id,
            numeric_value: valHigh,
            patient_sex: 'M',
            patient_age_days: 10000
        });
        console.log("Evaluation (HIGH expected):", resHigh);

    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(console.error);
