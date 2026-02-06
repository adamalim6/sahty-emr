
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { 
    Person, 
    CreatePersonPayload, 
    PatientRelationship, 
    PatientEmergencyContact, 
    PatientLegalGuardian, 
    PatientDecisionMaker 
} from '../models/patientNetwork';

export class PatientNetworkService {

    // --- PERSONS (Non-Patient) ---

    async createPerson(tenantId: string, payload: CreatePersonPayload): Promise<string> {
        const res = await tenantQuery(tenantId, `
            INSERT INTO persons (tenant_id, first_name, last_name, phone, email)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING person_id
        `, [tenantId, payload.firstName, payload.lastName, payload.phone, payload.email]);
        return res[0].person_id;
    }

    async getPerson(tenantId: string, personId: string): Promise<Person | null> {
        const res = await tenantQuery(tenantId, `SELECT * FROM persons WHERE person_id = $1`, [personId]);
        if (!res.length) return null;
        const r = res[0];
        return {
            personId: r.person_id,
            tenantId: r.tenant_id,
            firstName: r.first_name,
            lastName: r.last_name,
            phone: r.phone,
            email: r.email,
            createdAt: r.created_at
        };
    }

    // --- RELATIONSHIPS ---

    async addRelationship(tenantId: string, data: Partial<PatientRelationship>): Promise<string> {
        return await tenantTransaction(tenantId, async (client) => {
            // Validate exclusivity
            if (data.relatedPatientId && data.relatedPersonId) throw new Error("Cannot link both patient and person");
            if (!data.relatedPatientId && !data.relatedPersonId) throw new Error("Must link either patient or person");

            const res = await client.query(`
                INSERT INTO patient_relationships 
                (tenant_id, subject_patient_id, related_patient_id, related_person_id, relationship_type, valid_from, valid_to)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING relationship_id
            `, [
                tenantId, data.subjectPatientId, data.relatedPatientId, data.relatedPersonId, 
                data.relationshipType, data.validFrom, data.validTo
            ]);
            return res.rows[0].relationship_id;
        });
    }

    async getRelationships(tenantId: string, patientId: string): Promise<PatientRelationship[]> {
        const res = await tenantQuery(tenantId, `SELECT * FROM patient_relationships WHERE subject_patient_id = $1`, [patientId]);
        return res.map(r => ({
            relationshipId: r.relationship_id,
            tenantId: r.tenant_id,
            subjectPatientId: r.subject_patient_id,
            relatedPatientId: r.related_patient_id,
            relatedPersonId: r.related_person_id,
            relationshipType: r.relationship_type,
            validFrom: r.valid_from,
            validTo: r.valid_to,
            createdAt: r.created_at
        }));
    }

    // --- EMERGENCY CONTACTS ---

    async addEmergencyContact(tenantId: string, data: Partial<PatientEmergencyContact>): Promise<string> {
        return await tenantTransaction(tenantId, async (client) => {
             const res = await client.query(`
                INSERT INTO patient_emergency_contacts
                (tenant_id, tenant_patient_id, related_patient_id, related_person_id, relationship_label, priority)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING emergency_contact_id
            `, [
                tenantId, data.tenantPatientId, data.relatedPatientId, data.relatedPersonId,
                data.relationshipLabel, data.priority
            ]);
            return res.rows[0].emergency_contact_id;
        });
    }

    async getEmergencyContacts(tenantId: string, patientId: string): Promise<PatientEmergencyContact[]> {
        const res = await tenantQuery(tenantId, `SELECT * FROM patient_emergency_contacts WHERE tenant_patient_id = $1 ORDER BY priority ASC`, [patientId]);
        return res.map(r => ({
            emergencyContactId: r.emergency_contact_id,
            tenantId: r.tenant_id,
            tenantPatientId: r.tenant_patient_id,
            relatedPatientId: r.related_patient_id,
            relatedPersonId: r.related_person_id,
            relationshipLabel: r.relationship_label,
            priority: r.priority,
            createdAt: r.created_at
        }));
    }

    // --- LEGAL & DECISION MAKERS ---

    async addLegalGuardian(tenantId: string, data: Partial<PatientLegalGuardian>): Promise<string> {
         const res = await tenantQuery(tenantId, `
            INSERT INTO patient_legal_guardians
            (tenant_id, tenant_patient_id, related_patient_id, related_person_id, valid_from, valid_to, legal_basis)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING legal_guardian_id
        `, [
            tenantId, data.tenantPatientId, data.relatedPatientId, data.relatedPersonId,
            data.validFrom, data.validTo, data.legalBasis
        ]);
        return res[0].legal_guardian_id;
    }

    async addDecisionMaker(tenantId: string, data: Partial<PatientDecisionMaker>): Promise<string> {
        const res = await tenantQuery(tenantId, `
           INSERT INTO patient_decision_makers
           (tenant_id, tenant_patient_id, related_patient_id, related_person_id, role, priority, valid_from, valid_to)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING decision_maker_id
       `, [
           tenantId, data.tenantPatientId, data.relatedPatientId, data.relatedPersonId,
           data.role, data.priority, data.validFrom, data.validTo
       ]);
       return res[0].decision_maker_id;
   }

   // --- AGGREGATION ---

   async getNetwork(tenantId: string, patientId: string) {
       const [relationships, emergencyContacts, legalGuardians, decisionMakers] = await Promise.all([
           this.getRelationships(tenantId, patientId),
           this.getEmergencyContacts(tenantId, patientId),
           tenantQuery(tenantId, `SELECT * FROM patient_legal_guardians WHERE tenant_patient_id = $1`, [patientId]),
           tenantQuery(tenantId, `SELECT * FROM patient_decision_makers WHERE tenant_patient_id = $1 ORDER BY priority ASC`, [patientId])
       ]);

       // Helper to fetch details could be optimizing here (e.g. bulk fetch Person/Patient names)
       // For now, return raw IDs and let Frontend/Controller orchestrate enrichment if needed?
       // Ideally the service returns enriched data.
       // Let's stick to raw structured data, separate "getPersonName" helper if needed. 
       // Frontend often needs names. 
       // TODO: Implement enrichment if UI requires it in one shot. 

       return {
           relationships,
           emergencyContacts,
           legalGuardians: legalGuardians.map(r => ({ ...r, legalGuardianId: r.legal_guardian_id })),
           decisionMakers: decisionMakers.map(r => ({ ...r, decisionMakerId: r.decision_maker_id }))
       };
   }
}

export const patientNetworkService = new PatientNetworkService();
