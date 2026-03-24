import { PoolClient } from 'pg';

export interface EvaluationResult {
    interpretation: 'NORMAL' | 'ABNORMAL HIGH' | 'ABNORMAL LOW' | 'CAUTION HIGH' | 'CAUTION LOW' | 'ABNORMAL' | null;
    reference_low_numeric: number | null;
    reference_high_numeric: number | null;
    reference_range_text: string | null;
    abnormal_flag_text: string | null;
}

export class ReferenceEvaluationEngine {
    static async evaluate(
        client: PoolClient,
        lab_analyte_context_id: string | null,
        value: string | number | null,
        patient_sex: 'M' | 'F' | 'U',
        patient_age_days: number
    ): Promise<EvaluationResult> {
        const defaultResult: EvaluationResult = {
            interpretation: null,
            reference_low_numeric: null,
            reference_high_numeric: null,
            reference_range_text: null,
            abnormal_flag_text: null
        };

        if (!lab_analyte_context_id || value === null || value === undefined || value === '') {
            return defaultResult;
        }

        let numValue: number | null = null;
        if (typeof value === 'number') numValue = value;
        else if (typeof value === 'string') {
            const sanitized = value.replace(',', '.').trim();
            // Handle edge cases like "14.", "14," or empty
            if (sanitized === '' || sanitized.endsWith('.') || Number.isNaN(Number(sanitized))) {
                return defaultResult;
            }
            numValue = Number(sanitized);
        }

        if (numValue === null || Number.isNaN(numValue)) return defaultResult;

        // Find best profile
        const profileQuery = `
            SELECT id 
            FROM reference.lab_reference_profiles 
            WHERE analyte_context_id = $1
            AND actif = true
            AND (
                (sex = $2 AND (age_min_days IS NULL OR age_min_days <= $3) AND (age_max_days IS NULL OR age_max_days >= $3))
                OR
                (sex = 'U' AND (age_min_days IS NULL OR age_min_days <= $3) AND (age_max_days IS NULL OR age_max_days >= $3))
                OR
                is_default = true
            )
            ORDER BY 
                CASE WHEN sex = $2 THEN 1 WHEN sex = 'U' THEN 2 ELSE 3 END ASC,
                is_default DESC,
                sort_order ASC
            LIMIT 1
        `;

        const profileRes = await client.query(profileQuery, [lab_analyte_context_id, patient_sex, patient_age_days]);
        if (profileRes.rows.length === 0) return defaultResult;

        const profileId = profileRes.rows[0].id;

        // Fetch rules
        const ruleQuery = `
            SELECT * 
            FROM reference.lab_reference_rules 
            WHERE profile_id = $1 AND actif = true
            ORDER BY priority ASC, sort_order ASC
        `;
        const ruleRes = await client.query(ruleQuery, [profileId]);

        for (const rule of ruleRes.rows) {
            if (rule.rule_type === 'NUMERIC_INTERVAL' || rule.rule_type === 'NUMERIC_THRESHOLD') {
                const min = rule.lower_numeric ? Number(rule.lower_numeric) : null;
                const max = rule.upper_numeric ? Number(rule.upper_numeric) : null;
                
                let matches = true;
                if (min !== null) {
                    if (rule.lower_inclusive) matches = matches && numValue >= min;
                    else matches = matches && numValue > min;
                }
                if (max !== null) {
                    if (rule.upper_inclusive) matches = matches && numValue <= max;
                    else matches = matches && numValue < max;
                }

                if (matches) {
                    let flag = null;
                    if (rule.interpretation?.includes('HIGH')) flag = 'HIGH';
                    else if (rule.interpretation?.includes('LOW')) flag = 'LOW';
                    else if (rule.interpretation?.includes('ABNORMAL')) flag = 'ABNORMAL';
                    else if (rule.interpretation === 'NORMAL') flag = 'NORMAL';

                    return {
                        interpretation: rule.interpretation as EvaluationResult['interpretation'],
                        reference_low_numeric: min,
                        reference_high_numeric: max,
                        reference_range_text: rule.reference_text || rule.display_text || null,
                        abnormal_flag_text: flag
                    };
                }
            }
        }

        return defaultResult;
    }
}
