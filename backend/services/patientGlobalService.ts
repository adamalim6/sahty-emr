
import { 
    GlobalPatient, 
    IdentityDocumentType, 
    GlobalIdentityDocument,
    Country,
    CreateGlobalPatientPayload 
} from '../models/patientGlobal';
import { globalQuery } from '../db/globalPg';
import { identityQuery, identityTransaction } from '../db/identityPg';




// --- Types ---
// Since mapped from DB headers
interface MpiSourceRecordRow {
    source_record_id: string;
    tenant_id: string;
    tenant_patient_id: string;
    current_first_name: string;
    current_last_name: string;
    current_dob: Date | string;
    current_sex: 'M' | 'F';
    created_at: Date;
    updated_at: Date;
}

export class PatientGlobalService {

    // --- SEARCH ---

    async getIdentityWithDocs(id: string): Promise<{ patient: GlobalPatient, docs: GlobalIdentityDocument[] } | null> {
        // id is expected to be mpi_person_id or source_record_id. 
        // For compatibility with "Global Patient" view, we assume we are looking up a Source Record or a Person.
        // Let's assume ID is source_record_id for direct lookup, OR we find the best source record for a person.
        
        // Try finding by source_record_id first
        let patient = await this.getById(id);
        
        // If not found, maybe it's a mpi_person_id?
        if (!patient) {
            const bestRecord = await identityQuery(`
                SELECT r.* 
                FROM identity.mpi_source_records r
                JOIN identity.mpi_person_memberships m ON r.source_record_id = m.source_record_id
                WHERE m.mpi_person_id = $1
                ORDER BY r.last_seen_at DESC
                LIMIT 1
            `, [id]);
            
            if (bestRecord.length > 0) {
                patient = this.mapSourceRecord(bestRecord[0]);
            }
        }

        if (!patient) return null;

        // Get documents for this source record
        const docsRows = await identityQuery(`
            SELECT * FROM identity.mpi_source_identifiers WHERE source_record_id = $1
        `, [patient.id]);

        const docs = docsRows.map(this.mapIdentifier);
        
        return { patient, docs };
    }

    async findByDocument(documentNumber: string): Promise<GlobalPatient | null> {
        const rows = await identityQuery(`
            SELECT r.* 
            FROM identity.mpi_source_records r
            JOIN identity.mpi_source_identifiers i ON r.source_record_id = i.source_record_id
            WHERE i.identity_value = $1 
        `, [documentNumber]);
        
        return rows.length ? this.mapSourceRecord(rows[0]) : null;
    }

    async getById(id: string): Promise<GlobalPatient | null> {
         const rows = await identityQuery(`
            SELECT * FROM identity.mpi_source_records WHERE source_record_id = $1
        `, [id]);
        return rows.length ? this.mapSourceRecord(rows[0]) : null;
    }

    async getByIds(ids: string[]): Promise<GlobalPatient[]> {
        if (ids.length === 0) return [];
        const rows = await identityQuery(`SELECT * FROM identity.mpi_source_records WHERE source_record_id = ANY($1)`, [ids]);
        return rows.map(this.mapSourceRecord);
    }

    // --- MASTERS ---

    async getDocumentTypes(): Promise<IdentityDocumentType[]> {
        const rows = await globalQuery(`SELECT * FROM public.identity_document_types ORDER BY label`);
        return rows.map((r: any) => ({
            id: r.code, 
            code: r.code,
            label: r.label
        }));
    }

    async getCountries(): Promise<Country[]> {
        const rows = await globalQuery(`SELECT * FROM countries ORDER BY name`);
        return rows.map((r: any) => ({
            id: r.country_id,
            isoCode: r.iso_code,
            name: r.name
        }));
    }

    // --- WRITE ---

    async createIdentity(payload: CreateGlobalPatientPayload): Promise<GlobalPatient> {
        // 1. Pre-validate Document Types
        for (const doc of payload.documents) {
            const typeRes = await globalQuery(`SELECT code FROM public.identity_document_types WHERE code = $1`, [doc.documentTypeCode]);
            if (!typeRes.length) throw new Error(`Invalid Document Type: ${doc.documentTypeCode}`);
        }

        // 2. Execute Write Transaction on Identity DB
        // Creates a "Global" source record (fake tenant or system tenant)
        const GLOBAL_TENANT_ID = '00000000-0000-0000-0000-000000000000'; 
        const fakeTenantPatientId = crypto.randomUUID();

        return await identityTransaction(async (client) => {
            // A. Create MPI Person
            const personRes = await client.query(`
                INSERT INTO identity.mpi_persons (status) VALUES ('ACTIVE') RETURNING mpi_person_id
            `);
            const mpiPersonId = personRes.rows[0].mpi_person_id;

            // B. Create Source Record
            const recordRes = await client.query(`
                INSERT INTO identity.mpi_source_records 
                (tenant_id, tenant_patient_id, current_first_name, current_last_name, current_dob, current_sex)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [GLOBAL_TENANT_ID, fakeTenantPatientId, payload.firstName, payload.lastName, payload.dateOfBirth, payload.gender]);
            
            const record = recordRes.rows[0];

            // C. Link Person
            await client.query(`
                INSERT INTO identity.mpi_person_memberships (mpi_person_id, source_record_id, match_confidence, match_rule)
                VALUES ($1, $2, 100, 'MANUAL_GLOBAL_CREATION')
            `, [mpiPersonId, record.source_record_id]);

            // D. Insert Identifiers
            for (const doc of payload.documents) {
                await client.query(`
                    INSERT INTO identity.mpi_source_identifiers
                    (source_record_id, identity_type_code, identity_value, is_primary)
                    VALUES ($1, $2, $3, $4)
                `, [
                    record.source_record_id,
                    doc.documentTypeCode,
                    doc.documentNumber,
                    doc.isPrimary || false
                ]);
            }

            return this.mapSourceRecord(record);
        });
    }

    // --- HELPER ---
    private mapSourceRecord(row: any): GlobalPatient {
        const dob = row.current_dob instanceof Date 
            ? row.current_dob.toISOString().split('T')[0] 
            : row.current_dob;

        return {
            id: row.source_record_id,
            firstName: row.current_first_name,
            lastName: row.current_last_name,
            dateOfBirth: dob, 
            gender: row.current_sex, 
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private mapIdentifier(row: any): GlobalIdentityDocument {
        return {
            id: row.source_identifier_id,
            globalPatientId: row.source_record_id,
            documentTypeId: row.identity_type_code,
            documentNumber: row.identity_value,
            isPrimary: row.is_primary,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

export const patientGlobalService = new PatientGlobalService();
