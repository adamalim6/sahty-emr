import { PoolClient } from 'pg';
import { 
    PatientDocument, 
    CreatePatientDocumentDTO, 
    UpdatePatientDocumentStorageDTO 
} from '../models/patientDocument';

export class PatientDocumentRepository {
    async createDocumentMetadata(
        client: PoolClient,
        dto: CreatePatientDocumentDTO
    ): Promise<PatientDocument> {
        const query = `
            INSERT INTO public.patient_documents (
                tenant_id,
                tenant_patient_id,
                document_type,
                original_filename,
                mime_type,
                original_mime_type,
                file_extension,
                source_system,
                uploaded_by_user_id,
                uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            RETURNING *;
        `;
        const values = [
            dto.tenant_id,
            dto.tenant_patient_id,
            dto.document_type,
            dto.original_filename || null,
            dto.mime_type || null,
            dto.original_mime_type || null,
            dto.file_extension || null,
            dto.source_system || null,
            dto.uploaded_by_user_id || null
        ];

        const res = await client.query(query, values);
        return res.rows[0];
    }

    async updateDocumentStorageMetadata(
        client: PoolClient,
        id: string,
        dto: UpdatePatientDocumentStorageDTO
    ): Promise<PatientDocument> {
        const query = `
            UPDATE public.patient_documents
            SET 
                stored_filename = $2,
                storage_path = $3,
                file_size_bytes = $4,
                checksum = $5,
                updated_at = NOW()
            WHERE id = $1 AND actif = true
            RETURNING *;
        `;
        const values = [
            id,
            dto.stored_filename,
            dto.storage_path,
            dto.file_size_bytes,
            dto.checksum || null
        ];

        const res = await client.query(query, values);
        if (res.rowCount === 0) {
            throw new Error(`Patient document ${id} not found or inactive`);
        }
        return res.rows[0];
    }

    async getDocumentById(
        client: PoolClient,
        id: string,
        tenantId: string
    ): Promise<PatientDocument | null> {
        const query = `
            SELECT * FROM public.patient_documents
            WHERE id = $1 AND tenant_id = $2 AND actif = true;
        `;
        const res = await client.query(query, [id, tenantId]);
        return res.rows[0] || null;
    }

    async listDocumentsByPatient(
        client: PoolClient,
        tenantId: string,
        tenantPatientId: string,
        documentType?: string
    ): Promise<PatientDocument[]> {
        let query = `
            SELECT * FROM public.patient_documents
            WHERE tenant_id = $1 AND tenant_patient_id = $2 AND actif = true
        `;
        const values: any[] = [tenantId, tenantPatientId];

        if (documentType) {
            values.push(documentType);
            query += ` AND document_type = $3 `;
        }

        query += ` ORDER BY created_at DESC;`;

        const res = await client.query(query, values);
        return res.rows;
    }

    async softDeleteDocument(
        client: PoolClient,
        id: string,
        tenantId: string
    ): Promise<boolean> {
        const query = `
            UPDATE public.patient_documents
            SET actif = false, updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2
            RETURNING id;
        `;
        const res = await client.query(query, [id, tenantId]);
        return res.rowCount !== null && res.rowCount > 0;
    }
}
