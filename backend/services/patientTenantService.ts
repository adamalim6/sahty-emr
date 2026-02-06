
import { 
    TenantPatient, 
    PatientContact, 
    PatientAddress, 
    PatientInsurance, 
    PatientDetail,
    CreateTenantPatientPayload 
} from '../models/patientTenant';
import { patientGlobalService } from './patientGlobalService';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';

export class PatientTenantService {

    // --- READ ---

    async getAllTenantPatients(tenantId: string): Promise<PatientDetail[]> {
        // Fetch Tenant Patients (Limit 100 for now)
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM patients_tenant 
            ORDER BY created_at DESC 
            LIMIT 100
        `, []);
        
        if (rows.length === 0) return [];
        
        const globalIds = [...new Set(rows.map(r => r.global_patient_id))];
        const globalPatients = await patientGlobalService.getByIds(globalIds);
        
        return rows.map(r => {
            const gp = globalPatients.find(g => g.id === r.global_patient_id);
            if (!gp) return null;
            
            return {
                ...gp,
                tenantPatientId: r.tenant_patient_id,
                tenantId: r.tenant_id,
                medicalRecordNumber: r.medical_record_number,
                status: r.status,
                contacts: [], // specific detail fetch required
                addresses: [],
                insurances: [],
                identityDocuments: [],
                nationality: undefined
            };
        }).filter(p => p !== null) as PatientDetail[];
    }

    async getTenantPatient(tenantId: string, tenantPatientId: string): Promise<PatientDetail | null> {
        // 1. Get Tenant Link
        const linkRows = await tenantQuery(tenantId, `
            SELECT * FROM patients_tenant WHERE tenant_patient_id = $1
        `, [tenantPatientId]);
        
        if (!linkRows.length) return null;
        const link = linkRows[0];

        // 2. Parallel Fetch: Global Identity + Local Details
        const [identity, contacts, addresses, insurances] = await Promise.all([
            patientGlobalService.getIdentityWithDocs(link.global_patient_id),
            this.getContacts(tenantId, tenantPatientId),
            this.getAddresses(tenantId, tenantPatientId),
            this.getInsurances(tenantId, tenantPatientId)
        ]);

        if (!identity) {
            console.error(`Global Patient ID ${link.global_patient_id} not found for Tenant Patient ${tenantPatientId}`);
            return null; // Should not happen ideally
        }

        // 3. Assemble
        return {
            ...identity.patient, // Global fields
            identityDocuments: identity.docs, // Global docs

            tenantPatientId: link.tenant_patient_id,
            medicalRecordNumber: link.medical_record_number,
            status: link.status,
            tenantId: link.tenant_id, // Add tenantId to match TenantPatient interface if needed, detail view has it via extension? PatientDetail extends GlobalPatient which doesn't have tenantId.
            // Wait, PatientDetail interface has tenantPatientId. 
            
            contacts,
            addresses,
            insurances,
            nationality: undefined // TODO: Fetch Country view if needed or use ID.
        };
    }

    private async getContacts(tenantId: string, id: string): Promise<PatientContact[]> {
        const rows = await tenantQuery(tenantId, `SELECT * FROM patient_contacts WHERE tenant_patient_id = $1`, [id]);
        return rows.map(r => ({
            contactId: r.contact_id,
            tenantPatientId: r.tenant_patient_id,
            phone: r.phone,
            email: r.email,
            createdAt: r.created_at
        }));
    }

    private async getAddresses(tenantId: string, id: string): Promise<PatientAddress[]> {
        const rows = await tenantQuery(tenantId, `SELECT * FROM patient_addresses WHERE tenant_patient_id = $1`, [id]);
        return rows.map(r => ({
            addressId: r.address_id,
            tenantPatientId: r.tenant_patient_id,
            addressLine: r.address_line,
            city: r.city,
            countryId: r.country_id,
            createdAt: r.created_at
        }));
    }

    private async getInsurances(tenantId: string, id: string): Promise<PatientInsurance[]> {
        // Only active insurances by default? Or all including history?
        // Let's return all, UI can filter. Or active only. Usually detailed view shows current.
        // Let's return currently valid ones.
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM patient_insurances 
            WHERE tenant_patient_id = $1 
            AND row_valid_to IS NULL
        `, [id]);
        
        return rows.map(r => ({
            patientInsuranceId: r.patient_insurance_id,
            tenantPatientId: r.tenant_patient_id,
            insuranceOrgId: r.insurance_org_id,
            policyNumber: r.policy_number,
            planName: r.plan_name,
            subscriberName: r.subscriber_name,
            coverageValidFrom: r.coverage_valid_from,
            coverageValidTo: r.coverage_valid_to,
            rowValidFrom: r.row_valid_from,
            rowValidTo: r.row_valid_to
        }));
    }

    // --- WRITE ---

    async createTenantPatient(tenantId: string, payload: CreateTenantPatientPayload): Promise<string> {
        return await tenantTransaction(tenantId, async (client) => {
            // 1. Create Link
            const linkRes = await client.query(`
                INSERT INTO patients_tenant (tenant_id, global_patient_id, medical_record_number, nationality_id)
                VALUES ($1, $2, $3, $4)
                RETURNING tenant_patient_id
            `, [tenantId, payload.globalPatientId, payload.medicalRecordNumber, payload.nationalityId]);
            
            const tenantPatientId = linkRes.rows[0].tenant_patient_id;

            // 2. Contacts
            if (payload.contacts) {
                for (const c of payload.contacts) {
                    await client.query(`
                        INSERT INTO patient_contacts (tenant_patient_id, phone, email)
                        VALUES ($1, $2, $3)
                    `, [tenantPatientId, c.phone, c.email]);
                }
            }

            // 3. Addresses
            if (payload.addresses) {
                for (const a of payload.addresses) {
                    await client.query(`
                        INSERT INTO patient_addresses (tenant_patient_id, address_line, city, country_id)
                        VALUES ($1, $2, $3, $4)
                    `, [tenantPatientId, a.addressLine, a.city, a.countryId]);
                }
            }

            // 4. Insurances
            if (payload.insurances) {
                for (const i of payload.insurances) {
                    await client.query(`
                        INSERT INTO patient_insurances 
                        (tenant_patient_id, insurance_org_id, policy_number, plan_name, subscriber_name, coverage_valid_from, coverage_valid_to)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        tenantPatientId, 
                        i.insuranceOrgId, 
                        i.policyNumber, 
                        i.planName, 
                        i.subscriberName,
                        i.coverageValidFrom,
                        i.coverageValidTo
                    ]);
                }
            }

            return tenantPatientId;
        });
    }

    // --- UPDATES ---
    
    async addInsurance(tenantId: string, tenantPatientId: string, insurance: any): Promise<void> {
        // Close previous active insurance for same org?? 
        // Or just add new one. The rule was "To change insurance: close old row, insert new row".
        // This usually implies replacing the active coverage.
        
        await tenantTransaction(tenantId, async (client) => {
            // 1. Close existing active insurance (Optional: only if replacing)
            // For now, let's assume we just add. Logic for replacement can be substantial.
            // If user wants to "Update", they call updateInsurance.
            
            await client.query(`
                INSERT INTO patient_insurances 
                (tenant_patient_id, insurance_org_id, policy_number, plan_name, subscriber_name, coverage_valid_from, coverage_valid_to)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                tenantPatientId, 
                insurance.insuranceOrgId, 
                insurance.policyNumber, 
                insurance.planName, 
                insurance.subscriberName,
                insurance.coverageValidFrom,
                insurance.coverageValidTo
            ]);
        });
    }
}

export const patientTenantService = new PatientTenantService();
