import { PoolClient } from 'pg';
import { AttachLabReportDocumentDTO, PatientLabReportDocumentLink } from '../models/patientDocument';

export class LabDocumentLinkRepository {
    async attachDocumentToReport(
        client: PoolClient,
        dto: AttachLabReportDocumentDTO
    ): Promise<PatientLabReportDocumentLink> {
        const query = `
            INSERT INTO public.patient_lab_report_documents (
                patient_lab_report_id,
                document_id,
                derivation_type,
                sort_order
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (patient_lab_report_id, document_id) DO NOTHING
            RETURNING *;
        `;
        const values = [
            dto.patient_lab_report_id,
            dto.document_id,
            dto.derivation_type || 'ORIGINAL',
            dto.sort_order || 0
        ];

        const res = await client.query(query, values);
        
        // If rowCount is 0, it means there was a conflict (already linked)
        if (res.rowCount === 0 || res.rows.length === 0) {
            // Fetch the existing link to return it
            return this.getLink(client, dto.patient_lab_report_id, dto.document_id) as Promise<PatientLabReportDocumentLink>;
        }

        return res.rows[0];
    }

    async getLink(
        client: PoolClient, 
        patientLabReportId: string, 
        documentId: string
    ): Promise<PatientLabReportDocumentLink | null> {
        const query = `
            SELECT * FROM public.patient_lab_report_documents
            WHERE patient_lab_report_id = $1 AND document_id = $2
        `;
        const res = await client.query(query, [patientLabReportId, documentId]);
        return res.rows[0] || null;
    }

    async getDocumentsForReport(
        client: PoolClient,
        patientLabReportId: string
    ): Promise<PatientLabReportDocumentLink[]> {
        const query = `
            SELECT * FROM public.patient_lab_report_documents
            WHERE patient_lab_report_id = $1 AND actif = true
            ORDER BY sort_order ASC, created_at ASC;
        `;
        const res = await client.query(query, [patientLabReportId]);
        return res.rows;
    }

    async detachDocument(
        client: PoolClient,
        patientLabReportId: string,
        documentId: string
    ): Promise<boolean> {
        const query = `
            UPDATE public.patient_lab_report_documents
            SET actif = false, updated_at = NOW()
            WHERE patient_lab_report_id = $1 AND document_id = $2
            RETURNING id;
        `;
        const res = await client.query(query, [patientLabReportId, documentId]);
        return res.rowCount !== null && res.rowCount > 0;
    }
}
