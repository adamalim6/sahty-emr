/**
 * EMR Service - PostgreSQL Version (Refactored)
 * Manages admissions, appointments, and medication consumption (tenant).
 * Physical placement (rooms/beds/stays) is now in placementService.ts.
 */

// ... imports
import { Admission, Appointment, AdmissionMedicationConsumption } from '../models/emr';
import { AdmissionCoverage, AdmissionCoverageMember, Coverage, CoverageMember } from '../models/patientTenant';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { placementService } from './placementService';
import { v4 as uuidv4 } from 'uuid';

export class EmrService {
    
    // --- HELPERS FOR ADMISSION FORM ---

    async getHospitalServices(tenantId: string): Promise<any[]> {
        return await tenantQuery(tenantId, `
            SELECT id, name FROM services ORDER BY name
        `, []);
    }

    async getHospitalDoctors(tenantId: string): Promise<any[]> {
        return await tenantQuery(tenantId, `
            SELECT u.user_id as id, u.first_name, u.last_name, u.display_name
            FROM auth.users u
            JOIN public.user_roles ur ON ur.user_id = u.user_id
            JOIN reference.global_roles gr ON gr.id = ur.role_id
            WHERE gr.code IN ('MEDECIN', 'DOCTOR') AND u.is_active = TRUE
            ORDER BY u.last_name
        `, []);
    }

    // --- ADMISSIONS (TENANT) ---

    async getAllAdmissions(tenantId: string): Promise<Admission[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT a.*,
                   pt.first_name AS patient_first_name,
                   pt.last_name AS patient_last_name
            FROM admissions a
            LEFT JOIN patients_tenant pt ON pt.tenant_patient_id = a.tenant_patient_id
            ORDER BY a.admission_date DESC
        `, []);
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id,
            tenantPatientId: r.tenant_patient_id,
            admissionNumber: r.admission_number,
            reason: r.reason,
            attendingPhysicianUserId: r.attending_physician_user_id,
            admittingServiceId: r.admitting_service_id,
            responsibleServiceId: r.responsible_service_id,
            currentServiceId: r.current_service_id,
            admissionDate: r.admission_date,
            dischargeDate: r.discharge_date,
            status: r.status,
            currency: r.currency,
            admissionType: r.admission_type,
            arrivalMode: r.arrival_mode,
            provenance: r.provenance,
            // Legacy compat fields
            type: r.admission_type,
            nda: r.admission_number,
            service: r.current_service_id,
            patientId: r.tenant_patient_id,
        }));
    }

    async getAdmissionsByPatient(tenantId: string, patientId: string): Promise<Admission[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT a.*,
                   pt.first_name AS patient_first_name,
                   pt.last_name AS patient_last_name
            FROM admissions a
            LEFT JOIN patients_tenant pt ON pt.tenant_patient_id = a.tenant_patient_id
            WHERE a.tenant_patient_id = $1
            ORDER BY a.admission_date DESC
        `, [patientId]);
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id,
            tenantPatientId: r.tenant_patient_id,
            admissionNumber: r.admission_number,
            reason: r.reason,
            attendingPhysicianUserId: r.attending_physician_user_id,
            admittingServiceId: r.admitting_service_id,
            responsibleServiceId: r.responsible_service_id,
            currentServiceId: r.current_service_id,
            admissionDate: r.admission_date,
            dischargeDate: r.discharge_date,
            status: r.status,
            currency: r.currency,
            admissionType: r.admission_type,
            arrivalMode: r.arrival_mode,
            provenance: r.provenance,
            type: r.admission_type,
            nda: r.admission_number,
            service: r.current_service_id,
            patientId: r.tenant_patient_id,
        }));
    }

    async createAdmission(tenantId: string, data: Partial<Admission>): Promise<Admission> {
        return await tenantTransaction(tenantId, async (client) => {
            const id = data.id || require('uuid').v4();

            // Generate admission_number: ADM-YYYY-NNNNNN
            const seqResult = await client.query(`SELECT nextval('admission_number_seq') AS seq`);
            const seq = seqResult.rows[0].seq;
            const year = new Date().getFullYear();
            const admissionNumber = data.admissionNumber || `ADM-${year}-${String(seq).padStart(6, '0')}`;

            // Resolve tenantPatientId (new way) or patientId (legacy)
            const tenantPatientId = data.tenantPatientId || data.patientId || null;

            // Resolve service IDs — use specific fields or fall back to legacy 'service'
            const admittingServiceId = data.admittingServiceId || data.service || null;
            const responsibleServiceId = data.responsibleServiceId || data.service || null;
            const currentServiceId = data.currentServiceId || data.service || null;

            await client.query(`
                INSERT INTO admissions (
                    id, tenant_id, tenant_patient_id, admission_number, reason,
                    attending_physician_user_id, admitting_service_id, responsible_service_id, current_service_id,
                    admission_date, discharge_date, status, currency,
                    admission_type, arrival_mode, provenance
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `, [
                id, tenantId, tenantPatientId, admissionNumber, data.reason || null,
                data.attendingPhysicianUserId || null, admittingServiceId, responsibleServiceId, currentServiceId,
                data.admissionDate || new Date().toISOString(), data.dischargeDate || null,
                data.status || 'En cours', data.currency || 'MAD',
                data.type || null, data.arrivalMode || null, data.provenance || null
            ]);

            // --- EPIC COVERAGE SNAPSHOT LOGIC ---
            // If coverages are provided in the payload (e.g. from frontend selection), 
            // we snapshot them NOW.
            
            // Note: usage of 'any' for data.coverages as Admission interface might not have it yet
            const coveragesToSnapshot = (data as any).coverages; 

            if (coveragesToSnapshot && Array.isArray(coveragesToSnapshot) && coveragesToSnapshot.length > 0) {
                 for (const covItem of coveragesToSnapshot) {
                     // covItem: { coverageId: string, filingOrder: number }
                     await this.createAdmissionCoverageSnapshot(client, tenantId, id, covItem.coverageId, covItem.filingOrder || 1);
                 }
            }
            
            // --- PATIENT STAY LOGIC ---
            const bedId = (data as any).bedId;
            if (bedId) {
                 await client.query(`
                    INSERT INTO patient_stays (
                        id, admission_id, tenant_patient_id, bed_id, 
                        started_at, ended_at
                    ) VALUES ($1, $2, $3, $4, NOW(), NULL)
                 `, [uuidv4(), id, tenantPatientId, bedId]);

                 await client.query(`
                    UPDATE beds SET status = 'OCCUPIED' WHERE id = $1
                 `, [bedId]);
            }

            return {
                id,
                tenantId,
                tenantPatientId,
                admissionNumber,
                reason: data.reason || '',
                attendingPhysicianUserId: data.attendingPhysicianUserId,
                admittingServiceId,
                responsibleServiceId,
                currentServiceId,
                admissionDate: data.admissionDate || new Date().toISOString(),
                dischargeDate: data.dischargeDate,
                status: data.status || 'En cours',
                currency: data.currency || 'MAD',
                // Legacy compat
                nda: admissionNumber,
                service: currentServiceId,
                patientId: tenantPatientId,
            } as Admission;
        });
    }

    // --- SNAPSHOT HELPER ---
    
    /**
     * Creates an immutable snapshot of a master coverage for a specific admission.
     * This decouples the admission's billing data from future changes to the master coverage.
     */
    async createAdmissionCoverageSnapshot(
        client: any, 
        tenantId: string, 
        admissionId: string, 
        masterCoverageId: string,
        filingOrder: number
    ): Promise<void> {
        
        // 1. Fetch Master Data (Current State)
        const covRes = await client.query(`
            SELECT c.*, o.designation as organisme_name 
            FROM coverages c
            JOIN reference.organismes o ON o.id = c.organisme_id
            WHERE c.coverage_id = $1 AND c.tenant_id = $2
        `, [masterCoverageId, tenantId]);
        
        if (covRes.rows.length === 0) throw new Error(`Coverage ${masterCoverageId} not found`);
        const masterCov = covRes.rows[0];

        // 2. Fetch Master Members (Subscriber + Beneficiaries)
        // We need the Subscriber details to freeze them on the header
        // And we need the beneficiary details (usually the patient) to freeze as members
        const memRes = await client.query(`
            SELECT * FROM coverage_members 
            WHERE coverage_id = $1 AND tenant_id = $2
        `, [masterCoverageId, tenantId]);
        const members = memRes.rows;

        // 3. Identify Subscriber
        const subscriber = members.find((m: any) => m.relationship_to_subscriber_code === 'SELF');
        
        // 4. Create Snapshot Header (admission_coverages)
        // We copy relevant fields: Policy, Plan, Subscriber Info
        const admissionCoverageId = uuidv4();
        
        await client.query(`
            INSERT INTO admission_coverages (
                admission_coverage_id, tenant_id, admission_id, coverage_id, filing_order,
                organisme_id, policy_number, group_number, plan_name, coverage_type_code,
                subscriber_first_name, subscriber_last_name, 
                subscriber_identity_type, subscriber_identity_value, subscriber_issuing_country
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15
            )
        `, [
            admissionCoverageId, tenantId, admissionId, masterCoverageId, filingOrder,
            masterCov.organisme_id, masterCov.policy_number, masterCov.group_number, masterCov.plan_name, masterCov.coverage_type_code,
            subscriber?.member_first_name || null, subscriber?.member_last_name || null,
            subscriber?.member_identity_type || null, subscriber?.member_identity_value || null, subscriber?.member_issuing_country || null
        ]);

        // 5. Create Snapshot Members (admission_coverage_members)
        // Copy ALL members from master? Or just the patient?
        // Epic usually snapshots everyone on the policy at that time, or at least the relevant patient + subscriber.
        // Let's snapshot everyone found in master coverage_members to be safe.
        
        for (const m of members) {
             await client.query(`
                INSERT INTO admission_coverage_members (
                    admission_coverage_member_id, tenant_id, admission_coverage_id,
                    tenant_patient_id, 
                    member_first_name, member_last_name, 
                    relationship_to_subscriber_code,
                    member_identity_type, member_identity_value, member_issuing_country
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                )
             `, [
                 uuidv4(), tenantId, admissionCoverageId,
                 m.tenant_patient_id || null, // If linked to patient
                 m.member_first_name, m.member_last_name,
                 m.relationship_to_subscriber_code,
                 m.member_identity_type, m.member_identity_value, m.member_issuing_country
             ]);
        }
        
        // Log to history
        await client.query(`
            INSERT INTO admission_coverage_change_history (
                tenant_id, admission_id, admission_coverage_id,
                change_type_code, change_source, change_reason, new_value
            ) VALUES ($1, $2, $3, 'SNAPSHOT_CREATED', 'ADMISSION_ENTRY', 'Initial coverage assignment', $4)
        `, [tenantId, admissionId, admissionCoverageId, `Snapshot of Master Coverage ${masterCoverageId}`]);
    }

    async closeAdmission(tenantId: string, id: string): Promise<Admission | null> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM admissions WHERE id = $1', [id]);
        if (rows.length === 0) return null;
        const admission = rows[0];

        const dischargeDate = new Date().toISOString();
        
        await tenantTransaction(tenantId, async (client) => {
            await client.query(
                "UPDATE admissions SET status = 'Sorti', discharge_date = $1 WHERE id = $2", 
                [dischargeDate, id]
            );

            // End any active stay and free the bed
            const activeStays = await client.query(
                `SELECT id, bed_id FROM patient_stays WHERE admission_id = $1 AND ended_at IS NULL`, [id]);
            
            for (const stay of activeStays.rows) {
                await client.query(`UPDATE patient_stays SET ended_at = $2 WHERE id = $1`, [stay.id, dischargeDate]);
                // Free the bed if no other active stays
                const otherStays = await client.query(
                    `SELECT id FROM patient_stays WHERE bed_id = $1 AND ended_at IS NULL AND id != $2 LIMIT 1`,
                    [stay.bed_id, stay.id]);
                if (otherStays.rows.length === 0) {
                    await client.query(`UPDATE beds SET status = 'AVAILABLE' WHERE id = $1`, [stay.bed_id]);
                }
            }
        });

        return {
            id: admission.id,
            tenantId: admission.tenant_id,
            tenantPatientId: admission.tenant_patient_id,
            admissionNumber: admission.admission_number,
            reason: admission.reason,
            attendingPhysicianUserId: admission.attending_physician_user_id,
            admittingServiceId: admission.admitting_service_id,
            responsibleServiceId: admission.responsible_service_id,
            currentServiceId: admission.current_service_id,
            admissionDate: admission.admission_date,
            dischargeDate: dischargeDate,
            status: 'Sorti',
            currency: admission.currency,
            nda: admission.admission_number,
            service: admission.current_service_id,
        } as Admission;
    }

    async changeCurrentService(tenantId: string, admissionId: string, serviceId: string): Promise<void> {
        await tenantQuery(tenantId,
            `UPDATE admissions SET current_service_id = $2 WHERE id = $1`, [admissionId, serviceId]);
    }

    async changeResponsibleService(tenantId: string, admissionId: string, serviceId: string): Promise<void> {
        await tenantQuery(tenantId,
            `UPDATE admissions SET responsible_service_id = $2 WHERE id = $1`, [admissionId, serviceId]);
    }

    // --- APPOINTMENTS (TENANT) ---

    async getAllAppointments(tenantId: string): Promise<Appointment[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM appointments', []);
        return rows as any; 
    }

    // --- CONSUMPTIONS (TENANT) ---
    
    async addMedicationConsumption(tenantId: string, consumption: AdmissionMedicationConsumption) {
        console.warn("EmrService: addMedicationConsumption called. Should rely on Pharmacy Dispense Events.");
    }

    async getConsumptionsByAdmission(tenantId: string, admissionId: string): Promise<AdmissionMedicationConsumption[]> {
        const rows = await tenantQuery(tenantId, 
            'SELECT * FROM medication_dispense_events WHERE admission_id = $1', 
            [admissionId]
        );
        return rows.map(r => ({
            id: r.id,
            admissionId: r.admission_id,
            productId: r.product_id,
            productName: r.product_name || 'Unknown', 
            quantity: r.qty_dispensed,
            mode: 'BOX' as const,
            lotNumber: r.lot || '',
            batchNumber: r.lot || '',
            dispensedAt: r.dispensed_at || r.created_at,
            dispensedBy: r.dispensed_by || 'Pharmacy',
            expiryDate: r.expiry
        }));
    }

    // --- REFERENCE DATA (TENANT) ---

    async getOrganismes(tenantId: string) {
        return await tenantQuery(tenantId, 'SELECT * FROM reference.organismes WHERE active = TRUE ORDER BY designation', []);
    }

    async getCountries(tenantId: string) {
        return await tenantQuery(tenantId, 'SELECT * FROM reference.countries ORDER BY name', []);
    }

    async getCareCategories(tenantId: string) {
        return await tenantQuery(tenantId, 'SELECT id, code, label, is_active, sort_order FROM reference.care_categories WHERE is_active = TRUE ORDER BY sort_order ASC, label ASC', []);
    }

    async getIdentityDocumentTypes(tenantId: string) {
        // Hardcoded list to avoid missing table issues during refactor
        return [
            { code: 'CIN', label: 'Carte d\'Identité Nationale' },
            { code: 'PASSPORT', label: 'Passeport' },
            { code: 'CARTE_SEJOUR', label: 'Carte de Séjour' },
            { code: 'PERMIS_CONDUIRE', label: 'Permis de Conduire' },
            { code: 'LIVRET_FAMILLE', label: 'Livret de Famille' },
            { code: 'AUTRE', label: 'Autre' }
        ];
        // return await tenantQuery(tenantId, 'SELECT code, label FROM reference.identity_document_types ORDER BY code', []);
    }
}

export const emrService = new EmrService();
