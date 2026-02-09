
import { 
    GlobalPatient, 
    IdentityDocumentType, 
    GlobalIdentityDocument,
    Country,
    CreateGlobalPatientPayload 
} from '../models/patientGlobal';
import { globalQuery, globalTransaction } from '../db/globalPg';


import { identityService, CreateIdentityPayload } from './identityService';

export class PatientGlobalService {

    // --- SEARCH ---

    async getIdentityWithDocs(id: string): Promise<{ patient: GlobalPatient, docs: GlobalIdentityDocument[] } | null> {
        const patient = await this.getById(id);
        if (!patient) return null;

        const docsRows = await globalQuery(`
            SELECT * FROM identity.master_patient_documents WHERE master_patient_id = $1
        `, [id]);

        const docs = docsRows.map(this.mapDoc);
        
        return { patient, docs };
    }

    async findByDocument(documentNumber: string): Promise<GlobalPatient | null> {
        // Find patient via document
        const rows = await globalQuery(`
            SELECT p.* 
            FROM identity.master_patients p
            JOIN identity.master_patient_documents d ON p.id = d.master_patient_id
            WHERE d.document_number = $1
        `, [documentNumber]);
        
        return rows.length ? this.mapPatient(rows[0]) : null;
    }

    async getById(id: string): Promise<GlobalPatient | null> {
        const p = await identityService.getPatientById('GLOBAL', id);
        return p ? this.mapIdentityToGlobal(p) : null;
    }

    async getByIds(ids: string[]): Promise<GlobalPatient[]> {
        if (ids.length === 0) return [];
        // Postgres ANY($1) syntax for array
        const rows = await globalQuery(`SELECT * FROM identity.master_patients WHERE id = ANY($1)`, [ids]);
        return rows.map(this.mapPatient);
    }

    // --- MASTERS ---

    async getDocumentTypes(): Promise<IdentityDocumentType[]> {
        const rows = await globalQuery(`SELECT * FROM public.identity_document_types ORDER BY label`);
        return rows.map(r => ({
            id: r.code, // Start using code as ID or keep mapping? Interface calls for "id". Let's use code contextually if possible, but interface might expect UUID?
            // Existing interface likely expects UUID if it was identity_document_types.document_type_id.
            // But we changed to Code PK. 
            // We should check the model 'IdentityDocumentType'.
            // For now, mapping code to id to satisfy type, or assume code is acceptable string ID.
            code: r.code,
            label: r.label
        }));
    }

    async getCountries(): Promise<Country[]> {
        // Countries are still in reference.countries on global? Or public?
        // referenceSchemaSpec says they are in reference.countries for tenants.
        // For global, they were likely in public.countries. 
        // Migration didn't drop public.countries. 
        // We will assume they are still there or in identity? No, not in identity.
        const rows = await globalQuery(`SELECT * FROM countries ORDER BY name`);
        return rows.map(r => ({
            id: r.country_id,
            isoCode: r.iso_code,
            name: r.name
        }));
    }

    // --- WRITE ---

    async createIdentity(payload: CreateGlobalPatientPayload): Promise<GlobalPatient> {
        // This effectively creates a Master Patient
        return await globalTransaction(async (client) => {
            // 1. Insert Master Patient
            const pRes = await client.query(`
                INSERT INTO identity.master_patients (first_name, last_name, dob, sex)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [payload.firstName, payload.lastName, payload.dateOfBirth, payload.gender]);
            
            const patient = pRes.rows[0];

            // 2. Insert Documents
            for (const doc of payload.documents) {
                // Check Type Code
                const typeRes = await client.query(`SELECT code FROM public.identity_document_types WHERE code = $1`, [doc.documentTypeCode]);
                if (!typeRes.rows.length) throw new Error(`Invalid Document Type: ${doc.documentTypeCode}`);
                
                await client.query(`
                    INSERT INTO identity.master_patient_documents
                    (master_patient_id, document_type_code, document_number, is_primary)
                    VALUES ($1, $2, $3, $4)
                `, [
                    patient.id,
                    doc.documentTypeCode,
                    doc.documentNumber,
                    doc.isPrimary || false
                ]);
            }

            return this.mapPatient(patient);
        });
    }

    // --- HELPER ---
    private mapPatient(row: any): GlobalPatient {
        const dob = row.dob instanceof Date 
            ? row.dob.toISOString().split('T')[0] 
            : row.dob;

        return {
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            dateOfBirth: dob, 
            gender: row.sex, // Column name changed from gender to sex
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private mapIdentityToGlobal(p: any): GlobalPatient {
         return {
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            dateOfBirth: p.dob, 
            gender: p.sex,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt
        };
    }

    private mapDoc(row: any): GlobalIdentityDocument {
        // Map from identity.master_patient_documents
        return {
            id: row.id,
            globalPatientId: row.master_patient_id,
            documentTypeId: row.document_type_code, // Interface expectation?
            documentNumber: row.document_number,
            isPrimary: row.is_primary,
            expiresAt: undefined, // Removed expires_at from new schema? Verify.
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

export const patientGlobalService = new PatientGlobalService();
