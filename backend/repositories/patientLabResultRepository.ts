import { PoolClient } from 'pg';
import { PatientLabResult, CreatePatientLabResultDTO } from '../models/patientLabReport';

export class PatientLabResultRepository {
    async createLabResult(client: PoolClient, dto: CreatePatientLabResultDTO): Promise<PatientLabResult> {
        const res = await client.query(
            `INSERT INTO public.patient_lab_results (
                patient_lab_report_id, patient_lab_report_test_id, analyte_id,
                raw_analyte_label, value_type, numeric_value, text_value,
                boolean_value, choice_value, unit_id, raw_unit_text, reference_range_text,
                reference_low_numeric, reference_high_numeric, raw_abnormal_flag_text,
                abnormal_flag, observed_at, method_id, specimen_type_id,
                source_line_reference, notes, lab_analyte_context_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            ) RETURNING *;`,
            [
                dto.patient_lab_report_id,
                dto.patient_lab_report_test_id || null,
                dto.analyte_id || null,
                dto.raw_analyte_label || null,
                dto.value_type,
                dto.numeric_value ?? null,
                dto.text_value || null,
                dto.boolean_value ?? null,
                dto.choice_value || null,
                dto.unit_id || null,
                dto.raw_unit_text || null,
                dto.reference_range_text || null,
                dto.reference_low_numeric ?? null,
                dto.reference_high_numeric ?? null,
                dto.raw_abnormal_flag_text || null,
                (dto as any).abnormal_flag || null,
                dto.observed_at || null,
                dto.method_id || null,
                dto.specimen_type_id || null,
                dto.source_line_reference || null,
                dto.notes || null,
                dto.lab_analyte_context_id || null
            ]
        );
        return res.rows[0];
    }

    async getResultsByReportId(client: PoolClient, reportId: string): Promise<PatientLabResult[]> {
        const res = await client.query(
            `SELECT plr.*, 
                    COALESCE(plr.raw_analyte_label, lac.analyte_label) AS joined_analyte_label,
                    COALESCE(plr.raw_method_text, lac.method_label) AS joined_method_label,
                    COALESCE(plr.raw_specimen_type_text, lac.specimen_label) AS joined_specimen_label,
                    COALESCE(plr.raw_unit_text, lac.unit_label) AS joined_unit_label
             FROM public.patient_lab_results plr
             LEFT JOIN lab_analyte_contexts lac ON plr.lab_analyte_context_id = lac.id
             WHERE plr.patient_lab_report_id = $1 AND plr.status = 'ACTIVE'
             ORDER BY plr.created_at ASC`,
            [reportId]
        );
        return res.rows;
    }
}
