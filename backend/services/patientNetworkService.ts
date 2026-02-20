
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { 
    PatientRelationshipLink
} from '../models/patientTenant';

// Re-exporting legacy interfaces or defining new ones if needed by controller
// The controller uses `PatientRelationship`, `PatientEmergencyContact`, etc.
// I should map them to the new schema or update the controller.
// For now, I'll keep the methods signature if possible but return the new IDs.

export class PatientNetworkService {

    // --- PERSONS (Deprecated) ---
    async createPerson(tenantId: string, payload: any): Promise<string> {
        throw new Error("The 'persons' table has been removed in the Identity Refactor. Use 'createTenantPatient' or add a relationship with external details.");
    }

    async getPerson(tenantId: string, personId: string): Promise<any | null> {
        // We could verify if it's a patient, but 'persons' table is gone.
        return null; 
    }

    // --- RELATIONSHIPS (Unified) ---

    async addRelationship(tenantId: string, data: any): Promise<string> {
        // data: { subjectPatientId, relatedPatientId, relatedPersonId (ignored), relationshipType, validFrom, validTo }
        // We map this to patient_relationship_links
        
        return await tenantTransaction(tenantId, async (client) => {
            const res = await client.query(`
                INSERT INTO patient_relationship_links 
                (tenant_id, subject_tenant_patient_id, related_tenant_patient_id, relationship_type_code, valid_from, valid_to)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING relationship_id
            `, [
                tenantId, 
                data.subjectPatientId, 
                data.relatedPatientId || null, // If null, valid only if external fields provided?
                data.relationshipType || 'OTHER',
                data.validFrom || null,
                data.validTo || null
            ]);
            return res.rows[0].relationship_id;
        });
    }

    async getNetwork(tenantId: string, patientId: string) {
        // Fetch all links
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM patient_relationship_links 
            WHERE subject_tenant_patient_id = $1
            ORDER BY priority ASC, created_at DESC
        `, [patientId]);

        // Map to legacy buckets for Controller compatibility
        const relationships = rows.map(r => ({
            relationshipId: r.relationship_id,
            tenantId: r.tenant_id,
            subjectPatientId: r.subject_tenant_patient_id,
            relatedPatientId: r.related_tenant_patient_id,
            relationshipType: r.relationship_type_code,
            validFrom: r.valid_from,
            validTo: r.valid_to,
            createdAt: r.created_at,
            // External details
            relatedFirstName: r.related_first_name,
            relatedLastName: r.related_last_name
        }));

        const emergencyContacts = rows.filter(r => r.is_emergency_contact).map(r => ({
            emergencyContactId: r.relationship_id, // Reusing relationship_id
            tenantId: r.tenant_id,
            tenantPatientId: r.subject_tenant_patient_id,
            relatedPatientId: r.related_tenant_patient_id,
            relationshipLabel: r.relationship_type_code,
            priority: r.priority,
            createdAt: r.created_at,
             // External
             name: r.related_first_name && r.related_last_name ? `${r.related_first_name} ${r.related_last_name}` : 
                   r.related_first_name || r.related_last_name || 'Inconnu'
        }));

        const legalGuardians = rows.filter(r => r.is_legal_guardian).map(r => ({
            legalGuardianId: r.relationship_id,
            tenantId: r.tenant_id,
            tenantPatientId: r.subject_tenant_patient_id,
            relatedPatientId: r.related_tenant_patient_id,
            relationshipType: r.relationship_type_code,
            validFrom: r.valid_from,
            validTo: r.valid_to,
            // External
            firstName: r.related_first_name,
            lastName: r.related_last_name
        }));

        const decisionMakers = rows.filter(r => r.is_decision_maker).map(r => ({
            decisionMakerId: r.relationship_id,
            tenantId: r.tenant_id,
            tenantPatientId: r.subject_tenant_patient_id,
            priority: r.priority,
            role: r.relationship_type_code, // approximating 'role'
             // External
            firstName: r.related_first_name,
            lastName: r.related_last_name
        }));

        return {
            relationships,
            emergencyContacts,
            legalGuardians,
            decisionMakers
        };
    }

    // --- SPECIFIC ADDS ---

    async addEmergencyContact(tenantId: string, data: any): Promise<string> {
        return await tenantTransaction(tenantId, async (client) => {
             // If payload has 'name', split it for external
             let firstName = null; 
             let lastName = null;
             if (data.name) {
                 const parts = data.name.split(' ');
                 firstName = parts[0];
                 lastName = parts.slice(1).join(' ');
             }

             const res = await client.query(`
                INSERT INTO patient_relationship_links
                (tenant_id, subject_tenant_patient_id, related_tenant_patient_id, related_first_name, related_last_name, relationship_type_code, is_emergency_contact, priority)
                VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                RETURNING relationship_id
            `, [
                tenantId, 
                data.tenantPatientId, 
                data.relatedPatientId || null,
                firstName, lastName,
                data.relationshipLabel || 'OTHER', 
                data.priority || 1
            ]);
            return res.rows[0].relationship_id;
        });
    }

    async addLegalGuardian(tenantId: string, data: any): Promise<string> {
         // data: { tenantPatientId, relatedPatientId, firstName, lastName, relationshipType, ... }
         return await tenantTransaction(tenantId, async (client) => {
            const res = await client.query(`
                INSERT INTO patient_relationship_links
                (tenant_id, subject_tenant_patient_id, related_tenant_patient_id, related_first_name, related_last_name, relationship_type_code, is_legal_guardian, valid_from, valid_to)
                VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
                RETURNING relationship_id
            `, [
                tenantId,
                data.tenantPatientId,
                data.relatedPatientId || null,
                data.firstName, data.lastName,
                data.relationshipType || 'GUARDIAN', // Default?
                data.validFrom, data.validTo
            ]);
            return res.rows[0].relationship_id;
        });
    }
}

export const patientNetworkService = new PatientNetworkService();
