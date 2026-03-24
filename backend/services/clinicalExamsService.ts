import { getTenantPool } from '../db/tenantPg';
import { tenantObservationCatalogService } from './tenantObservationCatalogService';
import { PoolClient } from 'pg';

export interface ClinicalExamHeader {
    id: string;
    tenantId: string;
    tenantPatientId: string;
    observedAt: string;
    recordedAt: string;
    recordedBy: string;
    recordedByFirstName: string | null;
    recordedByLastName: string | null;
    lastAmendedAt: string | null;
    lastAmendedBy: string | null;
    lastAmendedByFirstName: string | null;
    lastAmendedByLastName: string | null;
    status: 'active' | 'entered_in_error';
    enteredInErrorAt: string | null;
    enteredInErrorBy: string | null;
    enteredInErrorByFirstName: string | null;
    enteredInErrorByLastName: string | null;
    enteredInErrorReason: string | null;
    measurements: Record<string, any>;
}

// Maps UI frontend keys -> DB observation parameter codes
export const PARAMETER_UI_MAP: Record<string, string> = {
    temperature: 'TEMP',
    weight: 'POIDS',
    height: 'TAILLE',
    pulse: 'FC',
    sao2: 'SPO2',
    sysBP: 'PA_SYS',
    diaBP: 'PA_DIA'
};

export const REVERSE_PARAMETER_UI_MAP: Record<string, string> = Object.entries(PARAMETER_UI_MAP).reduce((acc, [uiKey, dbCode]) => {
    acc[dbCode] = uiKey;
    return acc;
}, {} as Record<string, string>);


class ClinicalExamsService {
    
    async createExam(
        tenantId: string, 
        tenantPatientId: string, 
        observedAt: string, 
        userId: string, 
        firstName: string | null, 
        lastName: string | null,
        payload: Record<string, any>
    ): Promise<ClinicalExamHeader> {

        const observedDate = new Date(observedAt);
        if (observedDate > new Date()) {
            throw new Error('Observed date cannot be in the future.');
        }

        const bucketStart = new Date(observedDate);
        bucketStart.setMinutes(0, 0, 0);

        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const insertHeaderRes = await client.query(`
                INSERT INTO clinical_exams (
                    tenant_id, tenant_patient_id, observed_at, 
                    recorded_by, recorded_by_first_name, recorded_by_last_name
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [tenantId, tenantPatientId, observedDate.toISOString(), userId, firstName, lastName]);

            const header = insertHeaderRes.rows[0];

            // Resolve and construct measurement inserts
            for (const [uiKey, dbCode] of Object.entries(PARAMETER_UI_MAP)) {
                const val = payload[uiKey];
                if (val !== undefined && val !== null && val !== '') {
                    await this.insertEventRow(client, tenantId, tenantPatientId, header.id, observedDate.toISOString(), bucketStart.toISOString(), dbCode, val, userId, firstName, lastName);
                }
            }

            await client.query('COMMIT');

            return this.mapHeader(header, payload);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async updateExam(
        tenantId: string, 
        tenantPatientId: string, 
        examId: string,
        observedAt: string, 
        userId: string, 
        firstName: string | null, 
        lastName: string | null,
        payload: Record<string, any>
    ): Promise<ClinicalExamHeader> {

        const observedDate = new Date(observedAt);
        if (observedDate > new Date()) {
            throw new Error('Observed date cannot be in the future.');
        }

        const bucketStart = new Date(observedDate);
        bucketStart.setMinutes(0, 0, 0);

        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Verify existence and status
            const existingRes = await client.query(`SELECT * FROM clinical_exams WHERE id = $1 AND tenant_id = $2`, [examId, tenantId]);
            if (existingRes.rows.length === 0) throw new Error('Exam not found');
            if (existingRes.rows[0].status === 'entered_in_error') throw new Error('Cannot edit an exam marked as entered in error');

            // 2. Fetch ALL current latest effective values for this context_id
            const currentEffectiveRes = await client.query(`
                SELECT DISTINCT ON (parameter_code) parameter_code, value_numeric, value_text, value_boolean 
                FROM surveillance_values_events
                WHERE source_context = 'clinical_exam' AND context_id = $1
                ORDER BY parameter_code, recorded_at DESC, id DESC
            `, [examId]);

            const effectiveState: Record<string, string | number | boolean | null> = {};
            for (const row of currentEffectiveRes.rows) {
                effectiveState[row.parameter_code] = row.value_numeric ?? row.value_text ?? row.value_boolean;
            }

            // 3. Compare payload and append ONLY changed mapped values
            let appendedCount = 0;
            for (const [uiKey, dbCode] of Object.entries(PARAMETER_UI_MAP)) {
                if (uiKey in payload) {
                    const newVal = payload[uiKey];
                    const numVal = (newVal === '' || newVal === null) ? null : Number(newVal);
                    
                    const oldVal = effectiveState[dbCode];
                    const oldNum = oldVal === null || oldVal === undefined ? null : Number(oldVal);

                    if (numVal !== oldNum) {
                         if (numVal !== null) {
                             await this.insertEventRow(client, tenantId, tenantPatientId, examId, observedDate.toISOString(), bucketStart.toISOString(), dbCode, numVal, userId, firstName, lastName);
                             appendedCount++;
                         }
                    }
                }
            }

            // 4. Update Header explicitly to register the amendment (even if only date changed)
            const updateHeaderRes = await client.query(`
                UPDATE clinical_exams
                SET 
                    observed_at = $1,
                    last_amended_at = NOW(),
                    last_amended_by = $2,
                    last_amended_by_first_name = $3,
                    last_amended_by_last_name = $4
                WHERE id = $5 AND tenant_id = $6
                RETURNING *
            `, [observedDate.toISOString(), userId, firstName, lastName, examId, tenantId]);

            await client.query('COMMIT');

            // We return a skeleton, the frontend will refetch the list
            return this.mapHeader(updateHeaderRes.rows[0], {});
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async markEnteredInError(
        tenantId: string, 
        tenantPatientId: string, 
        examId: string,
        reason: string,
        userId: string, 
        firstName: string | null, 
        lastName: string | null
    ): Promise<ClinicalExamHeader> {
        const pool = getTenantPool(tenantId);
        const res = await pool.query(`
            UPDATE clinical_exams
            SET 
                status = 'entered_in_error',
                entered_in_error_at = NOW(),
                entered_in_error_by = $1,
                entered_in_error_by_first_name = $2,
                entered_in_error_by_last_name = $3,
                entered_in_error_reason = $4
            WHERE id = $5 AND tenant_id = $6 AND status = 'active'
            RETURNING *
        `, [userId, firstName, lastName, reason || null, examId, tenantId]);

        if (res.rows.length === 0) throw new Error('Exam not found or already invalidated');
        return this.mapHeader(res.rows[0], {});
    }


    async getPatientExams(tenantId: string, tenantPatientId: string, includeError: boolean = false): Promise<ClinicalExamHeader[]> {
        const pool = getTenantPool(tenantId);
        
        let statusFilter = "status = 'active'";
        if (includeError) {
            statusFilter = "status IN ('active', 'entered_in_error')";
        }

        const headersRes = await pool.query(`
            SELECT * FROM clinical_exams 
            WHERE tenant_patient_id = $1 AND tenant_id = $2
            AND ${statusFilter}
            ORDER BY observed_at DESC, recorded_at DESC
        `, [tenantPatientId, tenantId]);

        if (headersRes.rows.length === 0) return [];

        const headerIds = headersRes.rows.map(r => r.id);

        // Fetch effective latest measurements per context leveraging DISTINCT ON
        const eventsRes = await pool.query(`
            SELECT DISTINCT ON (context_id, parameter_code) 
                context_id, parameter_code, value_numeric, value_text, value_boolean
            FROM surveillance_values_events
            WHERE source_context = 'clinical_exam' AND context_id = ANY($1)
            ORDER BY context_id, parameter_code, recorded_at DESC, id DESC
        `, [headerIds]);

        // Group into context maps
        const contextMeasurements: Record<string, Record<string, any>> = {};
        for (const hid of headerIds) {
            contextMeasurements[hid] = {};
        }

        for (const row of eventsRes.rows) {
            const uiKey = REVERSE_PARAMETER_UI_MAP[row.parameter_code];
            if (uiKey) {
                // UI expects strings for input fields
                const val = row.value_numeric ?? row.value_text ?? row.value_boolean;
                if (val !== null && val !== undefined) {
                    contextMeasurements[row.context_id][uiKey] = String(val);
                }
            }
        }

        return headersRes.rows.map(row => this.mapHeader(row, contextMeasurements[row.id]));
    }

    private async insertEventRow(
        client: PoolClient,
        tenantId: string, tenantPatientId: string, contextId: string,
        observedAt: string, bucketStart: string,
        parameterCode: string, value: any,
        userId: string, firstName: string | null, lastName: string | null
    ) {
        // Resolve param config
        const parameter = await tenantObservationCatalogService.getParameterByCode(tenantId, parameterCode);
        if (!parameter) {
             throw new Error(`Parameter '${parameterCode}' not found or inactive in catalog.`);
        }

        let vNum = null, vTxt = null, vBool = null;
        if (parameter.valueType === 'number' || parameter.valueType === 'numeric') {
            vNum = Number(value);
            if (isNaN(vNum)) return;
        } else if (parameter.valueType === 'boolean') {
            vBool = Boolean(value);
        } else {
            vTxt = String(value);
        }

        await client.query(`
            INSERT INTO surveillance_values_events (
                tenant_id, tenant_patient_id, parameter_id, parameter_code,
                bucket_start, observed_at, source_context, context_id,
                value_numeric, value_text, value_boolean,
                recorded_by, recorded_at, recorded_by_first_name, recorded_by_last_name
            ) VALUES ($1, $2, $3, $4, $5, $6, 'clinical_exam', $7, $8, $9, $10, $11, NOW(), $12, $13)
        `, [
            tenantId, tenantPatientId, parameter.id, parameter.code,
            bucketStart, observedAt, contextId,
            vNum, vTxt, vBool,
            userId, firstName, lastName
        ]);
    }

    private mapHeader(row: any, measurements: Record<string, any>): ClinicalExamHeader {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            tenantPatientId: row.tenant_patient_id,
            observedAt: row.observed_at,
            recordedAt: row.recorded_at,
            recordedBy: row.recorded_by,
            recordedByFirstName: row.recorded_by_first_name,
            recordedByLastName: row.recorded_by_last_name,
            lastAmendedAt: row.last_amended_at,
            lastAmendedBy: row.last_amended_by,
            lastAmendedByFirstName: row.last_amended_by_first_name,
            lastAmendedByLastName: row.last_amended_by_last_name,
            status: row.status,
            enteredInErrorAt: row.entered_in_error_at,
            enteredInErrorBy: row.entered_in_error_by,
            enteredInErrorByFirstName: row.entered_in_error_by_first_name,
            enteredInErrorByLastName: row.entered_in_error_by_last_name,
            enteredInErrorReason: row.entered_in_error_reason,
            measurements
        };
    }
}

export const clinicalExamsService = new ClinicalExamsService();
