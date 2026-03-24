import { PoolClient } from 'pg';
import { LabDocumentLinkRepository } from '../repositories/labDocumentLinkRepository';
import { PatientDocumentService } from './patientDocumentService';
import { AttachLabReportDocumentDTO, PatientLabReportDocumentLink } from '../models/patientDocument';

export class LabDocumentLinkService {
    private linkRepository: LabDocumentLinkRepository;
    private documentService: PatientDocumentService;

    constructor(
        linkRepository: LabDocumentLinkRepository,
        documentService: PatientDocumentService
    ) {
        this.linkRepository = linkRepository;
        this.documentService = documentService;
    }

    async attachExistingDocumentToReport(
        client: PoolClient,
        dto: AttachLabReportDocumentDTO,
        tenantId: string
    ): Promise<PatientLabReportDocumentLink> {
        // Validation: Verify the document exists before linking
        const doc = await this.documentService.getDocumentById(client, dto.document_id, tenantId);
        if (!doc || !doc.actif) {
            throw new Error(`Document ${dto.document_id} does not exist or is inactive`);
        }

        // Additional validation: Verify the lab report exists could be done here 
        // or rely on the foreign key constraint directly in the repository.

        return this.linkRepository.attachDocumentToReport(client, dto);
    }

    async listDocumentsForReport(
        client: PoolClient,
        patientLabReportId: string
    ): Promise<PatientLabReportDocumentLink[]> {
        // This just returns the links. You might want to join or separately fetch the document metadatas.
        // For now, adhering strictly to the separation of concerns.
        return this.linkRepository.getDocumentsForReport(client, patientLabReportId);
    }

    async detachDocumentFromReport(
        client: PoolClient,
        patientLabReportId: string,
        documentId: string
    ): Promise<boolean> {
        return this.linkRepository.detachDocument(client, patientLabReportId, documentId);
    }
}
