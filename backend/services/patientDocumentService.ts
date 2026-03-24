import { PoolClient } from 'pg';
import { PatientDocumentRepository } from '../repositories/patientDocumentRepository';
import { DocumentStorageProvider } from './DocumentStorageProvider';
import { CreatePatientDocumentDTO, PatientDocument } from '../models/patientDocument';

export class PatientDocumentService {
    private repository: PatientDocumentRepository;
    private storageProvider: DocumentStorageProvider;

    constructor(
        repository: PatientDocumentRepository,
        storageProvider: DocumentStorageProvider
    ) {
        this.repository = repository;
        this.storageProvider = storageProvider;
    }

    async createDocumentMetadata(
        client: PoolClient,
        dto: CreatePatientDocumentDTO
    ): Promise<PatientDocument> {
        this.validateMetadata(dto);
        return this.repository.createDocumentMetadata(client, dto);
    }

    async getDocumentById(
        client: PoolClient,
        id: string,
        tenantId: string
    ): Promise<PatientDocument | null> {
        return this.repository.getDocumentById(client, id, tenantId);
    }

    async listPatientDocuments(
        client: PoolClient,
        tenantId: string,
        tenantPatientId: string,
        documentType?: string
    ): Promise<PatientDocument[]> {
        return this.repository.listDocumentsByPatient(client, tenantId, tenantPatientId, documentType);
    }

    async createDocumentFromBuffer(
        client: PoolClient,
        {
            tenantId,
            buffer,
            originalName,
            mimeType,
            originalMimeType,
            patientId,
            documentType,
            uploadedByUserId
        }: {
            tenantId: string;
            buffer: Buffer;
            originalName: string;
            mimeType: string;
            originalMimeType?: string;
            patientId: string;
            documentType: string;
            uploadedByUserId?: string;
        }
    ): Promise<string> {
        this.validateMetadata({ tenant_id: tenantId, tenant_patient_id: patientId, document_type: documentType });

        const result = await this.storageProvider.saveBuffer(tenantId, buffer, {
            originalName,
            mimeType
        });

        const doc = await this.repository.createDocumentMetadata(client, {
            tenant_id: tenantId,
            tenant_patient_id: patientId,
            document_type: documentType,
            original_filename: originalName,
            mime_type: mimeType,
            original_mime_type: originalMimeType,
            file_extension: originalName.split('.').pop() || 'tmp',
            source_system: 'WEB_UPLOAD',
            uploaded_by_user_id: uploadedByUserId
        });

        await this.repository.updateDocumentStorageMetadata(client, doc.id, {
            stored_filename: result.filename,
            storage_path: result.storagePath,
            file_size_bytes: buffer.length
        });

        return doc.id;
    }

    async getDocumentStream(
        client: PoolClient,
        id: string,
        tenantId: string
    ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
        const doc = await this.getDocumentById(client, id, tenantId);
        if (!doc) {
            throw new Error('Document not found');
        }
        if (!doc.storage_path) {
            throw new Error('Document has no storage path');
        }
        const stream = await this.storageProvider.getObjectStream(doc.storage_path);
        return { stream, mimeType: doc.mime_type || 'application/pdf' };
    }

    async softDeleteDocument(
        client: PoolClient,
        id: string,
        tenantId: string
    ): Promise<boolean> {
        const doc = await this.getDocumentById(client, id, tenantId);
        if (!doc) {
            return false;
        }

        const deletedDb = await this.repository.softDeleteDocument(client, id, tenantId);
        return deletedDb;
    }

    private validateMetadata(dto: CreatePatientDocumentDTO) {
        if (!dto.tenant_id) {
            throw new Error('tenant_id is required');
        }
        if (!dto.tenant_patient_id) {
            throw new Error('tenant_patient_id is required');
        }
        if (!dto.document_type) {
            throw new Error('document_type is required');
        }
        
        const validTypes = ['LAB_REPORT', 'RADIOLOGY', 'PRESCRIPTION', 'OTHER'];
        if (!validTypes.includes(dto.document_type as string)) {
            throw new Error(`Invalid document_type: ${dto.document_type}`);
        }
    }
}
