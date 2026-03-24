import { PoolClient } from 'pg';
import { PatientLabReportTest, CreatePatientLabReportTestDTO } from '../models/patientLabReport';

export class PatientLabReportTestRepository {
    async createReportTest(client: PoolClient, dto: CreatePatientLabReportTestDTO): Promise<PatientLabReportTest> {
        const res = await client.query(
            `INSERT INTO public.patient_lab_report_tests (
                patient_lab_report_id, global_act_id, panel_id, raw_test_label, display_order, notes
            ) VALUES (
                $1, $2, $3, $4, $5, $6
            ) RETURNING *;`,
            [
                dto.patient_lab_report_id,
                dto.global_act_id || null,
                dto.panel_id || null,
                dto.raw_test_label || null,
                dto.display_order || 0,
                dto.notes || null
            ]
        );
        return res.rows[0];
    }

    async getTestsByReportId(client: PoolClient, reportId: string): Promise<PatientLabReportTest[]> {
        const res = await client.query(
            `SELECT * FROM public.patient_lab_report_tests
             WHERE patient_lab_report_id = $1
             ORDER BY display_order ASC, created_at ASC`,
            [reportId]
        );
        return res.rows;
    }
}
