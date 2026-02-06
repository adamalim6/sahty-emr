
import { 
    GlobalPatient, 
    IdentityDocumentType, 
    GlobalIdentityDocument,
    Country,
    CreateGlobalPatientPayload 
} from '../models/patientGlobal';
import { globalQuery, globalTransaction } from '../db/globalPg';

export class PatientGlobalService {

    // --- SEARCH ---

    async getIdentityWithDocs(id: string): Promise<{ patient: GlobalPatient, docs: GlobalIdentityDocument[] } | null> {
        const patient = await this.getById(id);
        if (!patient) return null;

        const docsRows = await globalQuery(`
            SELECT * FROM global_identity_documents WHERE global_patient_id = $1
        `, [id]);

        const docs = docsRows.map(this.mapDoc);
        
        return { patient, docs };
    }

    async findByDocument(documentNumber: string): Promise<GlobalPatient | null> {
        // Find patient via document
        const rows = await globalQuery(`
            SELECT p.* 
            FROM patients_global p
            JOIN global_identity_documents d ON p.global_patient_id = d.global_patient_id
            WHERE d.document_number = $1
        `, [documentNumber]);
        
        return rows.length ? this.mapPatient(rows[0]) : null;
    }

    async getById(id: string): Promise<GlobalPatient | null> {
        const rows = await globalQuery(`SELECT * FROM patients_global WHERE global_patient_id = $1`, [id]);
        return rows.length ? this.mapPatient(rows[0]) : null;
    }

    async getByIds(ids: string[]): Promise<GlobalPatient[]> {
        if (ids.length === 0) return [];
        // Postgres ANY($1) syntax for array
        const rows = await globalQuery(`SELECT * FROM patients_global WHERE global_patient_id = ANY($1)`, [ids]);
        return rows.map(this.mapPatient);
    }

    // --- MASTERS ---

    async getDocumentTypes(): Promise<IdentityDocumentType[]> {
        const rows = await globalQuery(`SELECT * FROM identity_document_types ORDER BY label`);
        return rows.map(r => ({
            id: r.document_type_id,
            code: r.code,
            label: r.label
        }));
    }

    async getCountries(): Promise<Country[]> {
        const rows = await globalQuery(`SELECT * FROM countries ORDER BY name`);
        return rows.map(r => ({
            id: r.country_id,
            isoCode: r.iso_code,
            name: r.name
        }));
    }

    // --- WRITE ---

    async createIdentity(payload: CreateGlobalPatientPayload): Promise<GlobalPatient> {
        return await globalTransaction(async (client) => { // Use client passed from globalTransaction
            // 1. Insert Patient
            const pRes = await client.query(`
                INSERT INTO patients_global (first_name, last_name, date_of_birth, gender)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [payload.firstName, payload.lastName, payload.dateOfBirth, payload.gender]);
            
            const patient = pRes.rows[0];

            // 2. Insert Documents
            for (const doc of payload.documents) {
                // Resolve Type ID
                const typeRes = await client.query(`SELECT document_type_id FROM identity_document_types WHERE code = $1`, [doc.documentTypeCode]);
                if (!typeRes.rows.length) throw new Error(`Invalid Document Type: ${doc.documentTypeCode}`);
                
                const typeId = typeRes.rows[0].document_type_id;

                await client.query(`
                    INSERT INTO global_identity_documents 
                    (global_patient_id, document_type_id, document_number, is_primary, expires_at)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    patient.global_patient_id,
                    typeId,
                    doc.documentNumber,
                    doc.isPrimary || false,
                    doc.expiresAt || null
                ]);
            }

            return this.mapPatient(patient);
        });
    }

    // --- HELPER ---
    private mapPatient(row: any): GlobalPatient {
        // Handle date conversion if necessary (pg returns Date object for date/timestamp)
        const dob = row.date_of_birth instanceof Date 
            ? row.date_of_birth.toISOString().split('T')[0] 
            : row.date_of_birth;

        return {
            id: row.global_patient_id,
            firstName: row.first_name,
            lastName: row.last_name,
            dateOfBirth: dob, 
            gender: row.gender,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private mapDoc(row: any): GlobalIdentityDocument {
        const expires = row.expires_at instanceof Date 
            ? row.expires_at.toISOString().split('T')[0] 
            : row.expires_at;

        return {
            id: row.identity_document_id,
            globalPatientId: row.global_patient_id,
            documentTypeId: row.document_type_id,
            documentNumber: row.document_number,
            isPrimary: row.is_primary,
            expiresAt: expires,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

export const patientGlobalService = new PatientGlobalService();
