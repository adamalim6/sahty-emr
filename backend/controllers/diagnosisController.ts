import { tenantTransaction, tenantQuery } from '../db/tenantPg';
import { getTenantId, AuthRequest } from '../middleware/authMiddleware';

export const createDiagnosis = async (req: any, res: any) => {
    const tenantId = getTenantId(req);
    const { tenantPatientId } = req.params;
    const { 
        icd_linearization, 
        icd_language, 
        icd_code, 
        icd_title, 
        icd_selected_text, 
        icd_foundation_uri, 
        icd_linearization_uri, 
        source_query, 
        ect_instance_no 
    } = req.body;

    // Validate required WHO variables
    if (!icd_selected_text || !icd_foundation_uri) {
        return res.status(400).json({ error: 'Missing required ICD-11 fields: selectedText and foundationUri are mandatory' });
    }

    try {
        const result = await tenantTransaction(tenantId, async (client) => {
            // Verify patient exists
            const pCheck = await client.query('SELECT tenant_patient_id FROM public.patients_tenant WHERE tenant_patient_id = $1', [tenantPatientId]);
            if (pCheck.rows.length === 0) {
                throw new Error('Patient not found');
            }

            // Insert diagnosis
            const insertQuery = `
                INSERT INTO public.patient_diagnoses (
                    patient_id, status, clinician_user_id,
                    icd_linearization, icd_language, icd_code, icd_title,
                    icd_selected_text, icd_foundation_uri, icd_linearization_uri,
                    source_query, ect_instance_no
                ) VALUES (
                    $1, 'ACTIVE', $2,
                    $3, $4, $5, $6,
                    $7, $8, $9,
                    $10, $11
                ) RETURNING *;
            `;
            // Get userId safely from new AuthContext or legacy Fallback
            // Get userId safely from new AuthContext or legacy Fallback
            const clinicianUserId = req.auth?.userId || req.user?.userId || null;
            
            const values = [
                tenantPatientId, clinicianUserId,
                icd_linearization || 'mms', icd_language || 'fr', icd_code || null, icd_title || null,
                icd_selected_text, icd_foundation_uri, icd_linearization_uri || null,
                source_query || null, ect_instance_no || null
            ];
            
            console.log(`[createDiagnosis] Executing insert for tenant ${tenantId}, values:`, values);
            const insertRes = await client.query(insertQuery, values);
            console.log(`[createDiagnosis] Insert successful, returning ID:`, insertRes.rows[0]?.id);
            return insertRes.rows[0];
        });

        res.status(201).json(result);
    } catch (err: any) {
        console.error('[createDiagnosis] CRITICAL ERROR CREATING DIAGNOSIS:', err);
        if (err.message === 'Patient not found') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to create diagnosis', details: err.message, stack: err.stack, fullErr: err });
    }
};

export const getDiagnoses = async (req: any, res: any) => {
    const tenantId = getTenantId(req);
    const { tenantPatientId } = req.params;

    console.log(`[getDiagnoses] TRACE: Fetching for patient ${tenantPatientId} on tenant ${tenantId}`);

    try {
        const query = `
            SELECT 
                pd.*,
                u1.display_name as clinician_name,
                u2.display_name as resolved_by_name,
                u3.display_name as voided_by_name
            FROM public.patient_diagnoses pd
            LEFT JOIN auth.users u1 ON pd.clinician_user_id = u1.user_id
            LEFT JOIN auth.users u2 ON pd.resolved_by_user_id = u2.user_id
            LEFT JOIN auth.users u3 ON pd.voided_by_user_id = u3.user_id
            WHERE pd.patient_id = $1
            ORDER BY pd.entered_at DESC;
        `;
        const result = await tenantQuery(tenantId, query, [tenantPatientId]);
        console.log(`[getDiagnoses] TRACE: Found ${result.length} records`);
        res.json(result);
    } catch (err: any) {
        console.error('[getDiagnoses] CRITICAL ERROR FETCHING DIAGNOSES:', err);
        res.status(500).json({ error: 'Failed to fetch diagnoses', details: err.message, stack: err.stack });
    }
};

export const resolveDiagnosis = async (req: any, res: any) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { resolution_note } = req.body;
    
    const userId = req.auth?.userId || req.user?.userId || null;

    try {
        // Validate state
        const checkQuery = `SELECT status FROM public.patient_diagnoses WHERE id = $1`;
        const checkRes = await tenantQuery(tenantId, checkQuery, [id]);
        
        if (checkRes.length === 0) return res.status(404).json({ error: 'Diagnosis not found' });
        if (checkRes[0].status !== 'ACTIVE') return res.status(400).json({ error: 'Only ACTIVE diagnoses can be resolved.' });

        const updateQuery = `
            UPDATE public.patient_diagnoses
            SET status = 'RESOLVED', 
                resolved_at = NOW(),
                resolved_by_user_id = $2,
                resolution_note = $3
            WHERE id = $1 AND status = 'ACTIVE'
            RETURNING *;
        `;
        const result = await tenantQuery(tenantId, updateQuery, [id, userId, resolution_note || null]);
        res.json(result[0]);
    } catch (err: any) {
        console.error('[resolveDiagnosis] Error:', err);
        res.status(500).json({ error: 'Failed to resolve diagnosis' });
    }
};

export const voidDiagnosis = async (req: any, res: any) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { void_reason } = req.body;
    
    if (!void_reason || void_reason.trim() === '') {
        return res.status(400).json({ error: 'void_reason is required to void a diagnosis.' });
    }
    
    const userId = req.auth?.userId || req.user?.userId || null;

    try {
        const checkQuery = `SELECT status FROM public.patient_diagnoses WHERE id = $1`;
        const checkRes = await tenantQuery(tenantId, checkQuery, [id]);
        
        if (checkRes.length === 0) return res.status(404).json({ error: 'Diagnosis not found' });
        if (checkRes[0].status !== 'ACTIVE') return res.status(400).json({ error: 'Only ACTIVE diagnoses can be voided.' });

        const updateQuery = `
            UPDATE public.patient_diagnoses
            SET status = 'VOIDED', 
                voided_at = NOW(),
                voided_by_user_id = $2,
                void_reason = $3
            WHERE id = $1 AND status = 'ACTIVE'
            RETURNING *;
        `;
        const result = await tenantQuery(tenantId, updateQuery, [id, userId, void_reason]);
        res.json(result[0]);
    } catch (err: any) {
        console.error('[voidDiagnosis] Error:', err);
        res.status(500).json({ error: 'Failed to void diagnosis' });
    }
};

export const reactivateDiagnosis = async (req: any, res: any) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    
    try {
        const checkQuery = `SELECT status FROM public.patient_diagnoses WHERE id = $1`;
        const checkRes = await tenantQuery(tenantId, checkQuery, [id]);
        
        if (checkRes.length === 0) return res.status(404).json({ error: 'Diagnosis not found' });
        if (checkRes[0].status !== 'RESOLVED') return res.status(400).json({ error: 'Only RESOLVED diagnoses can be reactivated. VOIDED diagnoses are terminal.' });

        const updateQuery = `
            UPDATE public.patient_diagnoses
            SET status = 'ACTIVE', 
                resolved_at = NULL
                -- We DO NOT erase resolved_by_user_id or resolution_note intentionally
            WHERE id = $1 AND status = 'RESOLVED'
            RETURNING *;
        `;
        const result = await tenantQuery(tenantId, updateQuery, [id]);
        res.json(result[0]);
    } catch (err: any) {
        console.error('[reactivateDiagnosis] Error:', err);
        res.status(500).json({ error: 'Failed to reactivate diagnosis' });
    }
};
