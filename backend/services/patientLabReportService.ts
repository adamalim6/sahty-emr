import { Pool, PoolClient } from 'pg';
import { PatientLabReportRepository } from '../repositories/patientLabReportRepository';
import { PatientLabReportTestRepository } from '../repositories/patientLabReportTestRepository';
import { PatientLabResultRepository } from '../repositories/patientLabResultRepository';
import { CreatePatientLabReportDTO, CreatePatientLabReportTestDTO, CreatePatientLabResultDTO, PatientLabReport, PatientLabReportTest, PatientLabResult } from '../models/patientLabReport';
import { ReferenceEvaluationEngine } from './ReferenceEvaluationEngine';

export interface ReportTestPayload extends Omit<CreatePatientLabReportTestDTO, 'patient_lab_report_id'> {
    results: Omit<CreatePatientLabResultDTO, 'patient_lab_report_id' | 'patient_lab_report_test_id'>[];
}

export interface CreateFullLabReportPayload extends CreatePatientLabReportDTO {
    documentIds: string[];
    tests: ReportTestPayload[];
}

export class PatientLabReportService {
    constructor(
        private reportRepo: PatientLabReportRepository,
        private testRepo: PatientLabReportTestRepository,
        private resultRepo: PatientLabResultRepository
    ) {}

    async createFullLabReport(pool: Pool, tenantId: string, payload: CreateFullLabReportPayload): Promise<PatientLabReport> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            this.validateFullReport(payload);

            // 1. Create Report
            const report = await this.reportRepo.createReport(client, tenantId, payload);

            // 2. Link Documents
            for (let i = 0; i < payload.documentIds.length; i++) {
                const docId = payload.documentIds[i];
                await client.query(
                    `INSERT INTO public.patient_lab_report_documents (patient_lab_report_id, document_id, derivation_type, sort_order)
                     VALUES ($1, $2, 'ORIGINAL', $3)`,
                    [report.id, docId, i]
                );
            }

            // 3. Create Tests & Results
            if (payload.tests && payload.tests.length > 0) {
                for (let i = 0; i < payload.tests.length; i++) {
                    const testPayload = payload.tests[i];
                    
                    const test = await this.testRepo.createReportTest(client, {
                        ...testPayload,
                        patient_lab_report_id: report.id,
                        display_order: i
                    });

                    if (testPayload.results && testPayload.results.length > 0) {
                        for (const resultPayload of testPayload.results) {
                            // Validation Layer: value_type vs input
                            this.validateResultValueType(resultPayload);

                            await this.resultRepo.createLabResult(client, {
                                ...resultPayload,
                                patient_lab_report_id: report.id,
                                patient_lab_report_test_id: test.id
                            });
                        }
                    }
                }
            }

            await client.query('COMMIT');
            return report;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async addTestToReport(pool: Pool, tenantId: string, testPayload: CreatePatientLabReportTestDTO): Promise<PatientLabReportTest> {
        const client = await pool.connect();
        try {
            // Validate that the report exists in this tenant
            const report = await this.reportRepo.getReportById(client, tenantId, testPayload.patient_lab_report_id);
            if (!report) throw new Error('Lab report not found or does not belong to this tenant');

            return await this.testRepo.createReportTest(client, testPayload);
        } finally {
            client.release();
        }
    }

    async addResultToTest(pool: Pool, tenantId: string, resultPayload: CreatePatientLabResultDTO): Promise<PatientLabResult> {
        const client = await pool.connect();
        try {
            // Typically validate tenant. We can check test -> report -> tenant. For now simple:
            this.validateResultValueType(resultPayload);
            return await this.resultRepo.createLabResult(client, resultPayload);
        } finally {
            client.release();
        }
    }

    async getReportById(pool: Pool, tenantId: string, id: string) {
        const client = await pool.connect();
        try {
            const report = await this.reportRepo.getReportById(client, tenantId, id);
            if (!report) return null;

            const docsRes = await client.query(
                `SELECT pd.*, plrd.derivation_type, plrd.sort_order 
                 FROM public.patient_documents pd
                 JOIN public.patient_lab_report_documents plrd ON pd.id = plrd.document_id
                 WHERE plrd.patient_lab_report_id = $1 AND plrd.actif = true
                 ORDER BY plrd.sort_order ASC NULLS LAST, plrd.created_at ASC`,
                [report.id]
            );

            const tests = await this.testRepo.getTestsByReportId(client, report.id);
            const allResults = await this.resultRepo.getResultsByReportId(client, report.id);

            const testsWithResults = tests.map(t => ({
                ...t,
                results: allResults.filter(r => r.patient_lab_report_test_id === t.id)
            }));

            return {
                ...report,
                documents: docsRes.rows,
                tests: testsWithResults
            };
        } finally {
            client.release();
        }
    }

    async listReportsByPatient(pool: Pool, tenantId: string, tenantPatientId: string) {
        const client = await pool.connect();
        try {
            return await this.reportRepo.listReportsByPatient(client, tenantId, tenantPatientId);
        } finally {
            client.release();
        }
    }

    async updateReportDetails(pool: Pool, tenantId: string, id: string, data: any) {
        const client = await pool.connect();
        try {
            const report = await this.reportRepo.getReportById(client, tenantId, id);
            if (!report) throw new Error("Report not found");
            if (report.status === 'VALIDATED') {
                throw new Error("Cannot modify metadata of a validated lab report");
            }
            return await this.reportRepo.updateReport(client, tenantId, id, data);
        } finally {
            client.release();
        }
    }

    private validateFullReport(payload: CreateFullLabReportPayload) {
        if (!payload.tenant_patient_id) throw new Error('tenant_patient_id is required');
        if (!payload.source_type) throw new Error('source_type is required');
        if (!payload.uploaded_by_user_id) throw new Error('uploaded_by_user_id is required');
    }

    private validateResultValueType(result: Omit<CreatePatientLabResultDTO, 'patient_lab_report_id' | 'patient_lab_report_test_id'>) {
        if (result.value_type === 'NUMERIC' && (result.numeric_value === undefined || result.numeric_value === null)) {
            throw new Error('Numeric value is required when value_type is NUMERIC');
        }
        if (result.value_type === 'TEXT' && !result.text_value) {
            throw new Error('Text value is required when value_type is TEXT');
        }
        if (result.value_type === 'BOOLEAN' && (result.boolean_value === undefined || result.boolean_value === null)) {
            throw new Error('Boolean value is required when value_type is BOOLEAN');
        }
        if (result.value_type === 'CHOICE' && !result.choice_value) {
            throw new Error('Choice value is required when value_type is CHOICE');
        }
    }

    async mergeLabReportDocuments(
        pool: Pool, 
        tenantId: string, 
        reportId: string, 
        userId: string, 
        documentService: any
    ) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const report = await this.reportRepo.getReportById(client, tenantId, reportId);
            if (!report) throw new Error("Report not found");

            // Fetch originals
            const originalsRes = await client.query(`
                SELECT pd.* FROM public.patient_documents pd
                JOIN public.patient_lab_report_documents plrd ON pd.id = plrd.document_id
                WHERE plrd.patient_lab_report_id = $1 
                AND plrd.actif = true 
                AND plrd.derivation_type = 'ORIGINAL'
                ORDER BY plrd.sort_order ASC NULLS LAST, plrd.created_at ASC
            `, [reportId]);

            const sourceDocs = originalsRes.rows;
            if (sourceDocs.length === 0) {
                throw new Error("No documents to merge");
            }

            const buffers: { buffer: Buffer, mimeType: string }[] = [];
            for (const doc of sourceDocs) {
                const { stream, mimeType } = await documentService.getDocumentStream(client, doc.id, tenantId);
                const chunks: Buffer[] = [];
                for await (const chunk of stream) chunks.push(Buffer.from(chunk));
                buffers.push({ buffer: Buffer.concat(chunks), mimeType });
            }

            const { mergeToPDF } = await import('../utils/pdfMerger');
            const mergedBuffer = await mergeToPDF(buffers);

            // Deactivate old merged
            await client.query(`
                UPDATE public.patient_lab_report_documents 
                SET actif = false 
                WHERE patient_lab_report_id = $1 AND derivation_type = 'MERGED'
            `, [reportId]);

            // Save new merge doc
            const mergedDocId = await documentService.createDocumentFromBuffer(client, {
                tenantId,
                buffer: mergedBuffer,
                originalName: `merged_report_${reportId}.pdf`,
                mimeType: 'application/pdf',
                patientId: sourceDocs[0].tenant_patient_id,
                documentType: sourceDocs[0].document_type,
                uploadedByUserId: userId
            });

            // Link new merge doc
            await client.query(`
                INSERT INTO public.patient_lab_report_documents 
                (patient_lab_report_id, document_id, derivation_type, sort_order)
                VALUES ($1, $2, 'MERGED', NULL)
            `, [reportId, mergedDocId]);

            await client.query('COMMIT');
            return { mergedDocId };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async autosaveResults(pool: Pool, tenantId: string, reportId: string, rows: any[]) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const report = await this.reportRepo.getReportById(client, tenantId, reportId);
            if (!report) throw new Error("Report not found");
            if (report.status !== 'DRAFT') throw new Error("Only DRAFT reports can be autosaved");

            // STEP B (prep): Non-blocking patient fetch
            let sex: 'U' | 'M' | 'F' = 'U';
            let ageInDays = 0;
            let patientContextExists = false;
            
            // To prevent aborting the entire transaction on select failure, use a savepoint
            await client.query('SAVEPOINT patient_fetch');
            try {
                const patientRes = await client.query(`SELECT sex, date_of_birth FROM public.patients_tenant WHERE tenant_patient_id = $1`, [report.tenant_patient_id]);
                if (patientRes.rows.length > 0) {
                    const patient = patientRes.rows[0];
                    sex = (patient.sex === 'M' || patient.sex === 'F') ? patient.sex : 'U';
                    ageInDays = patient.date_of_birth ? Math.floor((new Date().getTime() - new Date(patient.date_of_birth).getTime()) / 86400000) : 0;
                    patientContextExists = true;
                }
                await client.query('RELEASE SAVEPOINT patient_fetch');
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT patient_fetch');
                console.error("Patient query failed, skipping context", e);
            }

            const savedRows = [];

            for (const row of rows) {
                await client.query('SAVEPOINT row_savepoint');

                // STEP A: ALWAYS INSERT FIRST
                // Sanitize numeric value to prevent PostgreSQL type crashes on invalid strings
                let safeNumericValue = row.numeric_value;
                if (safeNumericValue !== null && safeNumericValue !== undefined && safeNumericValue !== '') {
                    const parsed = Number(safeNumericValue);
                    if (isNaN(parsed)) {
                        safeNumericValue = null;
                    }
                }

                const mappedRow = {
                    ...row,
                    numeric_value: safeNumericValue,
                    patient_lab_report_id: reportId,
                    patient_lab_report_test_id: row.patient_lab_report_test_id || null,
                    lab_analyte_context_id: row.lab_analyte_context_id || null,
                    raw_analyte_label: row.raw_analyte_label || null,
                    status: 'ACTIVE',
                    // Null out interpretation fields for the initial insert guarantee
                    reference_low_numeric: null,
                    reference_high_numeric: null,
                    reference_range_text: null,
                    abnormal_flag: null
                };

                let finalResult;
                try {
                    if (row.id) {
                        // Update by ID directly
                        const updateRes = await client.query(`
                            UPDATE public.patient_lab_results SET
                                value_type = $1, numeric_value = $2, text_value = $3,
                                reference_low_numeric = $4, reference_high_numeric = $5,
                                reference_range_text = $6, abnormal_flag = $7,
                                updated_at = NOW()
                            WHERE id = $8 AND status = 'ACTIVE' RETURNING *;
                        `, [
                            mappedRow.value_type, mappedRow.numeric_value, mappedRow.text_value,
                            mappedRow.reference_low_numeric, mappedRow.reference_high_numeric,
                            mappedRow.reference_range_text, mappedRow.abnormal_flag,
                            row.id
                        ]);
                        finalResult = updateRes.rows[0];
                    } else if (row.lab_analyte_context_id) {
                        // Match mapped analyte active row
                        const existingRes = await client.query(`
                            SELECT id FROM public.patient_lab_results 
                            WHERE patient_lab_report_id = $1 
                            AND patient_lab_report_test_id IS NOT DISTINCT FROM $2 
                            AND lab_analyte_context_id = $3 
                            AND status = 'ACTIVE';
                        `, [reportId, mappedRow.patient_lab_report_test_id, mappedRow.lab_analyte_context_id]);

                        if (existingRes.rows.length > 0) {
                            const updateRes = await client.query(`
                                UPDATE public.patient_lab_results SET
                                    value_type = $1, numeric_value = $2, text_value = $3,
                                    reference_low_numeric = $4, reference_high_numeric = $5,
                                    reference_range_text = $6, abnormal_flag = $7,
                                    updated_at = NOW()
                                WHERE id = $8 RETURNING *;
                            `, [
                                mappedRow.value_type, mappedRow.numeric_value, mappedRow.text_value,
                                mappedRow.reference_low_numeric, mappedRow.reference_high_numeric,
                                mappedRow.reference_range_text, mappedRow.abnormal_flag,
                                existingRes.rows[0].id
                            ]);
                            finalResult = updateRes.rows[0];
                        } else {
                            finalResult = await this.resultRepo.createLabResult(client, mappedRow as any);
                        }
                    } else {
                        // Unmapped -> Insert entirely new ACTIVE row
                        finalResult = await this.resultRepo.createLabResult(client, mappedRow as any);
                    }
                    await client.query('RELEASE SAVEPOINT row_savepoint');
                } catch (upsertError) {
                    await client.query('ROLLBACK TO SAVEPOINT row_savepoint');
                    console.error("CRITICAL: UPSERT failed for raw data", row, upsertError);
                    continue; // Skip evaluation if even the basic insert fails
                }

                if (!finalResult) continue;

                // STEP B: EVALUATION MUST BE NON-BLOCKING
                await client.query('SAVEPOINT eval_savepoint');
                try {
                    const resultValueForEval = finalResult.value_type === 'NUMERIC' ? finalResult.numeric_value : (finalResult.value_type === 'TEXT' ? finalResult.text_value : null);
                    
                    if (finalResult.lab_analyte_context_id && patientContextExists && resultValueForEval !== null && resultValueForEval !== undefined) {
                        const interpretationData = await ReferenceEvaluationEngine.evaluate(
                            client, finalResult.lab_analyte_context_id, resultValueForEval, sex, ageInDays
                        ) as any;
                        
                        if (interpretationData && (interpretationData.interpretation || interpretationData.reference_range_text || interpretationData.reference_low_numeric !== null)) {
                            // Update the row with evaluated interpretation
                            const evalUpdateRes = await client.query(`
                                UPDATE public.patient_lab_results SET
                                    reference_low_numeric = $1, reference_high_numeric = $2,
                                    reference_range_text = $3, abnormal_flag = $4,
                                    updated_at = NOW()
                                WHERE id = $5 RETURNING *;
                            `, [
                                interpretationData.reference_low_numeric, interpretationData.reference_high_numeric,
                                interpretationData.reference_range_text, interpretationData.abnormal_flag_text,
                                finalResult.id
                            ]);
                            finalResult = evalUpdateRes.rows[0];
                        }
                    }
                    await client.query('RELEASE SAVEPOINT eval_savepoint');
                } catch (evalError) {
                    await client.query('ROLLBACK TO SAVEPOINT eval_savepoint');
                    console.error("Evaluation failed, skipping", evalError);
                }

                savedRows.push(finalResult);
            }

            await client.query(`UPDATE public.patient_lab_reports SET updated_at = NOW() WHERE id = $1`, [reportId]);
            await client.query('COMMIT');
            return savedRows;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async validateReport(pool: Pool, tenantId: string, reportId: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const report = await this.reportRepo.getReportById(client, tenantId, reportId);
            if (!report) throw new Error("Report not found");
            
            const res = await client.query(`
                UPDATE public.patient_lab_reports 
                SET status = 'VALIDATED', structuring_status = 'STRUCTURED', updated_at = NOW()
                WHERE id = $1 RETURNING *;
            `, [reportId]);
            
            await client.query('COMMIT');
            return res.rows[0];
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async correctResult(pool: Pool, tenantId: string, resultId: string, userId: string, payload: any) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const oldRes = await client.query(`SELECT * FROM public.patient_lab_results WHERE id = $1 AND status = 'ACTIVE'`, [resultId]);
            if (oldRes.rows.length === 0) throw new Error("Active result not found");
            const oldRow = oldRes.rows[0];

            const report = await this.reportRepo.getReportById(client, tenantId, oldRow.patient_lab_report_id);
            if (report?.status !== 'VALIDATED' && report?.status !== 'AMENDED') {
                throw new Error("Corrections are only allowed on VALIDATED or AMENDED reports");
            }

            // Mark old ENTERED_IN_ERROR
            await client.query(`
                UPDATE public.patient_lab_results 
                SET status = 'ENTERED_IN_ERROR', entered_in_error_by_user_id = $1, entered_in_error_at = NOW(), entered_in_error_reason = 'Correction'
                WHERE id = $2
            `, [userId, resultId]);

            // Re-evaluate the new numerical value against reference context
            const patientRes = await client.query(`SELECT sexe, date_of_birth FROM public.patients_tenant WHERE tenant_patient_id = $1`, [report.tenant_patient_id]);
            const patient = patientRes.rows[0];
            const sex = (patient.sexe === 'M' || patient.sexe === 'F') ? patient.sexe : 'U';
            const ageInDays = patient.date_of_birth ? Math.floor((new Date().getTime() - new Date(patient.date_of_birth).getTime()) / 86400000) : 0;

            const resultValue = payload.value_type === 'NUMERIC' ? payload.numeric_value : (payload.value_type === 'TEXT' ? payload.text_value : null);
            let interpretationData = { interpretation: null, reference_low_numeric: null, reference_high_numeric: null, reference_range_text: null, abnormal_flag_text: null };

            if (oldRow.lab_analyte_context_id && resultValue !== null && resultValue !== undefined) {
                interpretationData = await ReferenceEvaluationEngine.evaluate(client, oldRow.lab_analyte_context_id, resultValue, sex, ageInDays) as any;
            }

            const newRowPayload = {
                ...oldRow,
                value_type: payload.value_type,
                numeric_value: payload.numeric_value ?? null,
                text_value: payload.text_value ?? null,
                reference_low_numeric: interpretationData.reference_low_numeric ?? null,
                reference_high_numeric: interpretationData.reference_high_numeric ?? null,
                reference_range_text: interpretationData.reference_range_text ?? null,
                abnormal_flag: interpretationData.abnormal_flag_text ?? null,
                status: 'ACTIVE',
                id: undefined, created_at: undefined, updated_at: undefined // Let DB default insert these
            };

            const insertRes = await this.resultRepo.createLabResult(client, newRowPayload as any);

            // Shift report to AMENDED
            await client.query(`UPDATE public.patient_lab_reports SET status = 'AMENDED', updated_at = NOW() WHERE id = $1`, [report.id]);

            await client.query('COMMIT');
            return insertRes;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}
