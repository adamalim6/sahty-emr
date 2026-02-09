import { 
    TenantPatient, 
    PatientContact, 
    PatientAddress, 
    PatientInsurance, 
    PatientDetail,
    CreateTenantPatientPayload,
    PatientTenantMergeEvent,
    MergeChartGroup
} from '../models/patientTenant';
import { patientGlobalService } from './patientGlobalService'; 
import { identityService } from './identityService';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';

export class PatientTenantService {

    // --- READ ---

    async getAllTenantPatients(tenantId: string): Promise<PatientDetail[]> {
        // Fetch Tenant Patients (Limit 100 for now)
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM patients_tenant 
            WHERE status = 'ACTIVE'
            ORDER BY created_at DESC 
            LIMIT 100
        `, []);
        
        if (rows.length === 0) return [];
        
        return rows.map(r => ({
            id: r.master_patient_id, // Use master ID only
            firstName: r.first_name || 'Inconnu',
            lastName: r.last_name || 'Inconnu',
            dateOfBirth: r.dob, 
            gender: r.sex,
            createdAt: r.created_at,
            updatedAt: r.created_at,

            tenantPatientId: r.tenant_patient_id,
            tenantId: r.tenant_id,
            medicalRecordNumber: r.medical_record_number,
            status: r.status,
            contacts: [], 
            addresses: [],
            insurances: [],
            identityDocuments: [],
            nationality: undefined
        }));
    }

    async getTenantPatient(tenantId: string, tenantPatientId: string): Promise<PatientDetail | null> {
        // Resolve merge chain if this chart was merged into another
        const resolvedId = await this.resolveActiveTenantPatientId(tenantId, tenantPatientId);
        
        // 1. Get Tenant Link
        const linkRows = await tenantQuery(tenantId, `
            SELECT * FROM patients_tenant WHERE tenant_patient_id = $1
        `, [resolvedId]);
        
        if (!linkRows.length) return null;
        const link = linkRows[0];
        const masterId = link.master_patient_id; 

        // 2. Parallel Fetch: Global Identity + Local Details
        const [identity, contacts, addresses, insurances, localDocs] = await Promise.all([
            masterId ? identityService.getPatientById(tenantId, masterId) : null,
            this.getContacts(tenantId, tenantPatientId),
            this.getAddresses(tenantId, tenantPatientId),
            this.getInsurances(tenantId, tenantPatientId),
            this.getDocuments(tenantId, tenantPatientId)
        ]);

        return {
            id: masterId || 'LOCAL', 
            firstName: link.first_name || identity?.firstName || 'Inconnu',
            lastName: link.last_name || identity?.lastName || 'Inconnu',
            dateOfBirth: link.dob || identity?.dob,
            gender: link.sex || identity?.sex,
            createdAt: link.created_at,
            updatedAt: link.created_at,

            tenantPatientId: link.tenant_patient_id,
            tenantId: link.tenant_id,
            medicalRecordNumber: link.medical_record_number,
            status: link.status,
            
            contacts,
            addresses,
            insurances,
            identityDocuments: [], 
            
            nationality: undefined 
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
            addressLine2: r.address_line2,
            city: r.city,
            postalCode: r.postal_code,
            region: r.region,
            countryCode: r.country_code,
            countryId: r.country_id,
            isPrimary: r.is_primary,
            createdAt: r.created_at
        }));
    }

    private async getInsurances(tenantId: string, id: string): Promise<PatientInsurance[]> {
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

    private async getDocuments(tenantId: string, id: string): Promise<any[]> {
        return tenantQuery(tenantId, `SELECT * FROM patient_documents WHERE patient_id = $1`, [id]);
    }

    // --- WRITE ---

    async createTenantPatient(tenantId: string, payload: CreateTenantPatientPayload): Promise<string> {
        return await tenantTransaction(tenantId, async (client) => {
            // 1. Fetch Identity details
            let firstName = 'Inconnu';
            let lastName = 'Inconnu';
            let dob = null;
            let sex = null;

            if (payload.masterPatientId) {
                const identity = await identityService.getPatientById('GLOBAL', payload.masterPatientId);
                if (identity) {
                    firstName = identity.firstName;
                    lastName = identity.lastName;
                    dob = identity.dob;
                    sex = identity.sex;
                }
            }

            // 2. Create Link
            const linkRes = await client.query(`
                INSERT INTO patients_tenant 
                (tenant_id, master_patient_id, medical_record_number, nationality_id, first_name, last_name, dob, sex, mpi_link_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'LINKED')
                RETURNING tenant_patient_id
            `, [
                tenantId, 
                payload.masterPatientId, 
                payload.medicalRecordNumber, 
                payload.nationalityId,
                firstName,
                lastName,
                dob,
                sex
            ]);
            
            const tenantPatientId = linkRes.rows[0].tenant_patient_id;

            // 3. Contacts
            if (payload.contacts) {
                for (const c of payload.contacts) {
                    await client.query(`
                        INSERT INTO patient_contacts (tenant_patient_id, phone, email)
                        VALUES ($1, $2, $3)
                    `, [tenantPatientId, c.phone, c.email]);
                }
            }

            // 4. Addresses
            if (payload.addresses) {
                for (const a of payload.addresses) {
                    await client.query(`
                        INSERT INTO patient_addresses (tenant_patient_id, address_line, city, country_id)
                        VALUES ($1, $2, $3, $4)
                    `, [tenantPatientId, a.addressLine, a.city, a.countryId]);
                }
            }

            // 5. Insurances
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
        await tenantTransaction(tenantId, async (client) => {
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

    // ===================================================================
    // MERGE OPERATIONS
    // ===================================================================

    /**
     * Follow the merge chain to find the currently ACTIVE chart.
     * Detects loops (max 10 hops) and only resolves MERGED → ACTIVE.
     */
    async resolveActiveTenantPatientId(tenantId: string, tenantPatientId: string): Promise<string> {
        let currentId = tenantPatientId;
        const visited = new Set<string>();
        const MAX_HOPS = 10;

        for (let i = 0; i < MAX_HOPS; i++) {
            if (visited.has(currentId)) {
                console.error(`[PatientMerge] Loop detected in merge chain at ${currentId}`);
                return currentId; // Return current to avoid infinite loop
            }
            visited.add(currentId);

            const rows = await tenantQuery(tenantId, `
                SELECT status, merged_into_tenant_patient_id 
                FROM patients_tenant WHERE tenant_patient_id = $1
            `, [currentId]);

            if (!rows.length) return currentId; // Not found — return as-is
            if (rows[0].status !== 'MERGED') return currentId; // ACTIVE or INACTIVE — done
            if (!rows[0].merged_into_tenant_patient_id) return currentId; // Safety: no pointer

            currentId = rows[0].merged_into_tenant_patient_id;
        }

        console.error(`[PatientMerge] Merge chain exceeded ${MAX_HOPS} hops from ${tenantPatientId}`);
        return currentId;
    }

    /**
     * Merge source chart into target chart.
     * Both must be ACTIVE and belong to the same tenant.
     * Does NOT rewrite any clinical FKs.
     */
    async mergeTenantPatients(
        tenantId: string,
        sourceId: string,
        targetId: string,
        reason?: string,
        userId?: string
    ): Promise<PatientTenantMergeEvent> {
        return await tenantTransaction(tenantId, async (client) => {
            // 1. Validate both exist and are ACTIVE in this tenant
            const sourceRows = await client.query(
                `SELECT tenant_patient_id, tenant_id, status FROM patients_tenant WHERE tenant_patient_id = $1`,
                [sourceId]
            );
            const targetRows = await client.query(
                `SELECT tenant_patient_id, tenant_id, status FROM patients_tenant WHERE tenant_patient_id = $1`,
                [targetId]
            );

            if (!sourceRows.rows.length) throw new Error(`Source chart ${sourceId} not found`);
            if (!targetRows.rows.length) throw new Error(`Target chart ${targetId} not found`);

            const source = sourceRows.rows[0];
            const target = targetRows.rows[0];

            if (source.tenant_id !== target.tenant_id) {
                throw new Error('Cannot merge charts from different tenants');
            }
            if (source.status !== 'ACTIVE') {
                throw new Error(`Source chart status is '${source.status}', must be 'ACTIVE'`);
            }
            if (target.status !== 'ACTIVE') {
                throw new Error(`Target chart status is '${target.status}', must be 'ACTIVE'`);
            }

            // 2. Insert merge event
            const eventRes = await client.query(`
                INSERT INTO patient_tenant_merge_events 
                (tenant_id, source_tenant_patient_id, target_tenant_patient_id, reason, merged_by_user_id)
                VALUES ($1::uuid, $2, $3, $4, $5)
                RETURNING *
            `, [tenantId, sourceId, targetId, reason || null, userId || null]);

            // 3. Update source: mark as MERGED with pointer
            await client.query(`
                UPDATE patients_tenant 
                SET status = 'MERGED', merged_into_tenant_patient_id = $1
                WHERE tenant_patient_id = $2
            `, [targetId, sourceId]);

            const evt = eventRes.rows[0];
            return {
                mergeEventId: evt.merge_event_id,
                tenantId: evt.tenant_id,
                sourceTenantPatientId: evt.source_tenant_patient_id,
                targetTenantPatientId: evt.target_tenant_patient_id,
                reason: evt.reason,
                mergedByUserId: evt.merged_by_user_id,
                createdAt: evt.created_at
            };
        });
    }

    /**
     * Find duplicate charts: multiple ACTIVE charts sharing the same master_patient_id.
     */
    async findDuplicateCharts(tenantId: string): Promise<MergeChartGroup[]> {
        // Find master_patient_ids with >1 active chart
        const dupes = await tenantQuery(tenantId, `
            SELECT master_patient_id, COUNT(*) as cnt
            FROM patients_tenant
            WHERE status = 'ACTIVE' AND master_patient_id IS NOT NULL
            GROUP BY master_patient_id
            HAVING COUNT(*) > 1
        `, []);

        if (dupes.length === 0) return [];

        const groups: MergeChartGroup[] = [];
        for (const d of dupes) {
            const charts = await tenantQuery(tenantId, `
                SELECT * FROM patients_tenant 
                WHERE master_patient_id = $1 AND status = 'ACTIVE'
                ORDER BY created_at ASC
            `, [d.master_patient_id]);

            groups.push({
                masterPatientId: d.master_patient_id,
                charts: charts.map(r => ({
                    tenantPatientId: r.tenant_patient_id,
                    tenantId: r.tenant_id,
                    masterPatientId: r.master_patient_id,
                    medicalRecordNumber: r.medical_record_number,
                    firstName: r.first_name,
                    lastName: r.last_name,
                    dob: r.dob,
                    sex: r.sex,
                    status: r.status,
                    mergedIntoTenantPatientId: r.merged_into_tenant_patient_id,
                    createdAt: r.created_at
                }))
            });
        }

        return groups;
    }

    /**
     * Get merge history for a specific chart (as source or target).
     */
    async getMergeHistory(tenantId: string, tenantPatientId: string): Promise<PatientTenantMergeEvent[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM patient_tenant_merge_events
            WHERE source_tenant_patient_id = $1 OR target_tenant_patient_id = $1
            ORDER BY created_at DESC
        `, [tenantPatientId]);

        return rows.map(r => ({
            mergeEventId: r.merge_event_id,
            tenantId: r.tenant_id,
            sourceTenantPatientId: r.source_tenant_patient_id,
            targetTenantPatientId: r.target_tenant_patient_id,
            reason: r.reason,
            mergedByUserId: r.merged_by_user_id,
            createdAt: r.created_at
        }));
    }
}

export const patientTenantService = new PatientTenantService();
