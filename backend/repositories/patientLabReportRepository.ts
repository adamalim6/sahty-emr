import { PoolClient } from 'pg';
import { PatientLabReport, CreatePatientLabReportDTO } from '../models/patientLabReport';

export class PatientLabReportRepository {
    async createReport(client: PoolClient, tenantId: string, dto: CreatePatientLabReportDTO): Promise<PatientLabReport> {
        // First verify tenant isolation via tenant_patient_id (assuming it belongs to tenantId)
        // Ensure tenant isolation
        const patientCheck = await client.query(
            `SELECT 1 FROM public.patients_tenant WHERE tenant_patient_id = $1 AND tenant_id = $2`,
            [dto.tenant_patient_id, tenantId]
        );
        if (patientCheck.rowCount === 0) {
            throw new Error('Patient not found in this tenant');
        }

        const res = await client.query(
            `INSERT INTO public.patient_lab_reports (
                tenant_patient_id, admission_id, source_type, status, structuring_status,
                report_title, source_lab_name, source_lab_report_number,
                report_date, collected_at, received_at, interpretation_text, notes, uploaded_by_user_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            ) RETURNING *;`,
            [
                dto.tenant_patient_id,
                dto.admission_id || null,
                dto.source_type,
                dto.status,
                dto.structuring_status,
                dto.report_title || null,
                dto.source_lab_name || null,
                dto.source_lab_report_number || null,
                dto.report_date || null,
                dto.collected_at || null,
                dto.received_at || null,
                dto.interpretation_text || null,
                dto.notes || null,
                dto.uploaded_by_user_id
            ]
        );

        return res.rows[0];
    }

    async getReportById(client: PoolClient, tenantId: string, id: string): Promise<PatientLabReport | null> {
        const res = await client.query(
            `SELECT r.* FROM public.patient_lab_reports r
             JOIN public.patients_tenant p ON r.tenant_patient_id = p.tenant_patient_id
             WHERE r.id = $1 AND p.tenant_id = $2`,
            [id, tenantId]
        );
        return res.rows[0] || null;
    }

    async listReportsByPatient(client: PoolClient, tenantId: string, tenantPatientId: string): Promise<PatientLabReport[]> {
        const res = await client.query(
            `SELECT r.* FROM public.patient_lab_reports r
             JOIN public.patients_tenant p ON r.tenant_patient_id = p.tenant_patient_id
             WHERE r.tenant_patient_id = $1 AND p.tenant_id = $2
             ORDER BY r.created_at DESC`,
            [tenantPatientId, tenantId]
        );
        return res.rows;
    }

    async updateReport(client: PoolClient, tenantId: string, id: string, data: any): Promise<PatientLabReport> {
        // Enforce tenant isolation via the associated tenant_patient_id
        const res = await client.query(
            `UPDATE public.patient_lab_reports
             SET report_title = $1,
                 source_lab_name = $2,
                 source_lab_report_number = $3,
                 report_date = $4,
                 collected_at = $5
             WHERE id = $6 AND tenant_patient_id IN (
                 SELECT tenant_patient_id FROM public.patients_tenant WHERE tenant_id = $7
             )
             RETURNING *`,
            [
                data.report_title !== undefined ? data.report_title : null,
                data.source_lab_name !== undefined ? data.source_lab_name : null,
                data.source_lab_report_number !== undefined ? data.source_lab_report_number : null,
                data.report_date !== undefined ? data.report_date : null,
                data.collected_at !== undefined ? data.collected_at : null,
                id,
                tenantId
            ]
        );
        if (res.rowCount === 0) throw new Error("Report not found or not in tenant");
        return res.rows[0];
    }
}
