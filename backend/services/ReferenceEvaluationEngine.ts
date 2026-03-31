import { PoolClient } from 'pg';

export interface EvaluationRequest {
    analyte_context_id: string;
    numeric_value: number | null;
    text_value: string | null;
    boolean_value: boolean | null;
    patient_sex: 'M' | 'F' | 'U';
    patient_age_days: number;
}

export interface EvaluationResult {
    interpretation: string | null;
    reference_low: number | null;
    reference_high: number | null;
    reference_text: string | null;
}

export class ReferenceEvaluationEngine {
    
    async evaluate(client: PoolClient, req: EvaluationRequest): Promise<EvaluationResult | null> {
        // Strict guard
        if (!req.analyte_context_id) {
            return null;
        }

        // STEP 1 - Fetch context to safely determine the evaluation shape
        const contextRes = await client.query(`
            SELECT cached_value_type FROM reference.lab_analyte_contexts WHERE id = $1
        `, [req.analyte_context_id]);
        
        if (contextRes.rows.length === 0) return null;
        const valueType = contextRes.rows[0].cached_value_type;

        // Skip evaluation if no valid value was provided for the expected type
        if (valueType === 'NUMERIC' && (req.numeric_value == null || isNaN(req.numeric_value))) return null;
        if (valueType === 'TEXT' && !req.text_value) return null;
        if (valueType === 'BOOLEAN' && req.boolean_value == null) return null;
        if (valueType === 'CHOICE' && !req.text_value) return null; // Choices are textual

        // STEP 2 - Fetch candidate profiles
        const profilesRes = await client.query(`
            SELECT * FROM reference.lab_reference_profiles
            WHERE analyte_context_id = $1 AND actif = true
        `, [req.analyte_context_id]);

        if (profilesRes.rows.length === 0) return null;

        // STEP 3 - Select correct profile (Priority: Exact Match > Unisex Fallback > Empty Fallback)
        let bestProfile = null;
        
        for (const p of profilesRes.rows) {
            const sexMatch = p.sex === req.patient_sex || p.sex === 'U' || !p.sex;
            const ageMatch = (p.age_min_days == null || req.patient_age_days >= p.age_min_days) &&
                             (p.age_max_days == null || req.patient_age_days <= p.age_max_days);
                             
            if (p.sex === req.patient_sex && ageMatch) {
                bestProfile = p;
                break; // Absolute perfect match
            } else if ((p.sex === 'U' || !p.sex) && ageMatch && !bestProfile) {
                bestProfile = p; // Partial match fallback
            } else if (!bestProfile) {
                bestProfile = p; // Ultimate fallback
            }
        }
        
        if (!bestProfile) return null;

        // STEP 4 - Fetch rules
        const rulesRes = await client.query(`
            SELECT * FROM reference.lab_reference_rules
            WHERE profile_id = $1 AND actif = true
            ORDER BY priority ASC
        `, [bestProfile.id]);

        // Define generic payload
        const interpretedResult: EvaluationResult = {
            interpretation: null, // Default
            reference_low: null,
            reference_high: null,
            reference_text: null
        };

        // Extract normative generic display parameters
        const normalRule = rulesRes.rows.find(r => r.interpretation === 'NORMAL');
        if (normalRule) {
            interpretedResult.reference_low = normalRule.lower_numeric ? parseFloat(normalRule.lower_numeric) : null;
            interpretedResult.reference_high = normalRule.upper_numeric ? parseFloat(normalRule.upper_numeric) : null;
            interpretedResult.reference_text = normalRule.display_text || normalRule.reference_text || null;
            
            if (valueType === 'TEXT' || valueType === 'CHOICE') {
                 interpretedResult.reference_text = normalRule.canonical_value_id ? "Valeur attendue" : normalRule.display_text || normalRule.reference_text || null;
            }
        }

        // STEP 5 - Evaluate Rules based strictly on cached_value_type
        for (const r of rulesRes.rows) {
            let matches = false;

            if (valueType === 'NUMERIC') {
                const min = r.lower_numeric != null ? parseFloat(r.lower_numeric) : -Infinity;
                const max = r.upper_numeric != null ? parseFloat(r.upper_numeric) : Infinity;

                const passesMin = r.lower_inclusive ? req.numeric_value! >= min : req.numeric_value! > min;
                const passesMax = r.upper_inclusive ? req.numeric_value! <= max : req.numeric_value! < max;

                matches = passesMin && passesMax;
            } 
            else if (valueType === 'TEXT' || valueType === 'CHOICE') {
                // If the rule defined a textual reference text match: (assuming text matching here if simple equals)
                if (r.reference_text && req.text_value) {
                    matches = req.text_value.trim().toLowerCase() === r.reference_text.trim().toLowerCase();
                } else if (r.canonical_value_id) {
                    // Logic to evaluate against canonical ID if the UI provided one
                    // For now, if textual rule uses a string canonical representation:
                    matches = req.text_value === r.canonical_value_id;
                }
            } 
            else if (valueType === 'BOOLEAN') {
                // Assuming reference_text stores "TRUE" or "FALSE" or we could map canonical_value_id
                if (r.reference_text) {
                    matches = String(req.boolean_value).toUpperCase() === r.reference_text.trim().toUpperCase();
                }
            }

            if (matches) {
                interpretedResult.interpretation = r.interpretation ? r.interpretation.replace(' ', '_').toUpperCase() : null;
                break; // Stop at highest priority rule match
            }
        }

        return interpretedResult;
    }
}
