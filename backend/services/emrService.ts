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

    // --- PRESCRIPTION → ADMISSION RESOLUTION ---

    /**
     * Resolves the best admission for a new prescription, or auto-creates an ORDER_ONLY admission.
     * 
     * Priority rules (highest first):
     *   1. Soins intensifs
     *   2. Hospitalisation complète
     *   3. Hôpital de jour
     *   4. Ambulatoire
     *   5. Urgence
     *   6. ORDER_ONLY
     * 
     * LAB_WALKIN is EXCLUDED from prescription assignment (mandatory).
     */
    async resolveOrCreateAdmissionForPrescription(tenantId: string, patientId: string): Promise<string> {
        const PRIORITY_ORDER = [
            'Soins intensifs',
            'Hospitalisation complète',
            'Hôpital de jour',
            'Ambulatoire',
            'Urgence',
            'ORDER_ONLY'
        ];

        // 1. Fetch all active admissions for the patient (exclude LAB_WALKIN)
        const activeAdmissions = await tenantQuery(tenantId, `
            SELECT id, admission_type
            FROM public.admissions
            WHERE tenant_patient_id = $1
              AND status = 'En cours'
              AND (admission_type IS NULL OR admission_type != 'LAB_WALKIN')
            ORDER BY admission_date DESC
        `, [patientId]);

        if (activeAdmissions.length === 1) {
            return activeAdmissions[0].id;
        }

        if (activeAdmissions.length > 1) {
            // Apply priority rules — pick the highest-priority admission
            const sorted = activeAdmissions.sort((a: any, b: any) => {
                const aPrio = PRIORITY_ORDER.indexOf(a.admission_type);
                const bPrio = PRIORITY_ORDER.indexOf(b.admission_type);
                // Unknown types go to the end
                return (aPrio === -1 ? 999 : aPrio) - (bPrio === -1 ? 999 : bPrio);
            });
            return sorted[0].id;
        }

        // 0 eligible admissions → auto-create ORDER_ONLY
        const newId = uuidv4();
        const seqResult = await tenantQuery(tenantId, `SELECT nextval('admission_number_seq') AS seq`, []);
        const seq = seqResult[0].seq;
        const year = new Date().getFullYear();
        const admissionNumber = `ORD-${year}-${String(seq).padStart(6, '0')}`;

        await tenantQuery(tenantId, `
            INSERT INTO public.admissions (
                id, tenant_id, tenant_patient_id, admission_number,
                admission_type, admission_date, auto_close_at,
                status, currency
            ) VALUES (
                $1, $2, $3, $4,
                'ORDER_ONLY', NOW(), NOW() + INTERVAL '7 days',
                'En cours', 'MAD'
            )
        `, [newId, tenantId, patientId, admissionNumber]);

        return newId;
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

    async createAdmission(tenantId: string, data: Partial<Admission>, userId: string | null = null): Promise<Admission> {
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

            // --- COVERAGE BINDING LOGIC ---
            // If the caller provided an explicit coverages payload (e.g. admission wizard
            // with an override), use it. Otherwise auto-seed from the patient's existing
            // coverage_members — whichever coverages the patient is already a member of
            // become the admission's bindings, ordered by created_at (first-registered
            // becomes filing_order=1 / primary).
            const coveragesToSnapshot = (data as any).coverages;

            if (coveragesToSnapshot && Array.isArray(coveragesToSnapshot) && coveragesToSnapshot.length > 0) {
                for (const covItem of coveragesToSnapshot) {
                    await this.createAdmissionCoverageSnapshot(client, tenantId, id, covItem.coverageId, covItem.filingOrder || 1, userId);
                }
            } else if (tenantPatientId) {
                const autoRes = await client.query(`
                    SELECT cm.coverage_id
                    FROM coverage_members cm
                    JOIN coverages c ON c.coverage_id = cm.coverage_id
                    WHERE cm.tenant_id = $1
                      AND cm.tenant_patient_id = $2
                      AND c.status = 'ACTIVE'
                    ORDER BY cm.created_at ASC
                `, [tenantId, tenantPatientId]);
                let order = 1;
                for (const row of autoRes.rows) {
                    await this.createAdmissionCoverageSnapshot(client, tenantId, id, row.coverage_id, order++, userId);
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
        filingOrder: number,
        userId: string | null = null
    ): Promise<void> {
        // Helper — for a linked patient, pull the primary non-MRN identity from identity_ids;
        // for an external member (tenant_patient_id NULL) fall back to the denormalized
        // member_* columns on coverage_members.
        const resolveIdentity = async (memberRow: any | null): Promise<{
            type: string | null; value: string | null; country: string | null;
        }> => {
            if (!memberRow) return { type: null, value: null, country: null };
            if (memberRow.tenant_patient_id) {
                const idRes = await client.query(`
                    SELECT identity_type_code, identity_value, issuing_country_code
                    FROM identity_ids
                    WHERE tenant_id = $1
                      AND tenant_patient_id = $2
                      AND status = 'ACTIVE'
                      AND identity_type_code <> 'LOCAL_MRN'
                    ORDER BY is_primary DESC, created_at ASC
                    LIMIT 1
                `, [tenantId, memberRow.tenant_patient_id]);
                const row = idRes.rows[0];
                if (row) return {
                    type:    row.identity_type_code,
                    value:   row.identity_value,
                    country: row.issuing_country_code
                };
            }
            return {
                type:    memberRow.member_identity_type     || null,
                value:   memberRow.member_identity_value    || null,
                country: memberRow.member_issuing_country   || null
            };
        };

        // 1. Fetch master coverage + organisme designation (for name snapshot)
        const covRes = await client.query(`
            SELECT c.*, o.designation AS organisme_name
            FROM coverages c
            JOIN reference.organismes o ON o.id = c.organisme_id
            WHERE c.coverage_id = $1 AND c.tenant_id = $2
        `, [masterCoverageId, tenantId]);
        if (covRes.rows.length === 0) throw new Error(`Coverage ${masterCoverageId} not found`);
        const masterCov = covRes.rows[0];

        // 2. Identify the admitted patient (member lookup target)
        const admRes = await client.query(
            `SELECT tenant_patient_id FROM admissions WHERE id = $1 AND tenant_id = $2`,
            [admissionId, tenantId]
        );
        const admittedPatientId = admRes.rows[0]?.tenant_patient_id ?? null;

        // 3. Locate the admitted patient's own coverage_members row
        let memberRow: any = null;
        if (admittedPatientId) {
            const memRes = await client.query(`
                SELECT cm.*, pt.first_name AS linked_first_name, pt.last_name AS linked_last_name
                FROM coverage_members cm
                LEFT JOIN patients_tenant pt ON pt.tenant_patient_id = cm.tenant_patient_id
                WHERE cm.coverage_id = $1 AND cm.tenant_patient_id = $2
                LIMIT 1
            `, [masterCoverageId, admittedPatientId]);
            memberRow = memRes.rows[0] || null;
        }

        // 4. Locate the SELF member (subscriber)
        const selfRes = await client.query(`
            SELECT cm.*, pt.first_name AS linked_first_name, pt.last_name AS linked_last_name
            FROM coverage_members cm
            LEFT JOIN patients_tenant pt ON pt.tenant_patient_id = cm.tenant_patient_id
            WHERE cm.coverage_id = $1 AND cm.relationship_to_subscriber_code = 'SELF'
            LIMIT 1
        `, [masterCoverageId]);
        const subscriber = selfRes.rows[0] || null;

        // 5. Resolve identity triples (prefer identity_ids for linked patients)
        const subscriberIdentity = await resolveIdentity(subscriber);
        const memberIdentity     = await resolveIdentity(memberRow);

        // 5. Insert the versioned binding row (single row — members are absorbed via coverage_member_id FK).
        const admissionCoverageId = uuidv4();
        await client.query(`
            INSERT INTO admission_coverages (
                admission_coverage_id, tenant_id, admission_id,
                coverage_id, coverage_member_id, filing_order,
                organisme_id, organisme_name_snapshot,
                policy_number_snapshot, group_number_snapshot, plan_name_snapshot, coverage_type_code_snapshot,
                subscriber_first_name_snapshot, subscriber_last_name_snapshot,
                subscriber_identity_type_snapshot, subscriber_identity_value_snapshot, subscriber_issuing_country_snapshot,
                member_first_name_snapshot, member_last_name_snapshot,
                relationship_to_subscriber_code_snapshot,
                member_identity_type_snapshot, member_identity_value_snapshot, member_issuing_country_snapshot,
                binding_status, bound_at, bound_by_user_id
            ) VALUES (
                $1, $2, $3,
                $4, $5, $6,
                $7, $8,
                $9, $10, $11, $12,
                $13, $14,
                $15, $16, $17,
                $18, $19,
                $20,
                $21, $22, $23,
                'ACTIVE', NOW(), $24
            )
        `, [
            admissionCoverageId, tenantId, admissionId,
            masterCoverageId, memberRow?.coverage_member_id || null, filingOrder,
            masterCov.organisme_id, masterCov.organisme_name,
            masterCov.policy_number, masterCov.group_number, masterCov.plan_name, masterCov.coverage_type_code,
            subscriber?.linked_first_name || subscriber?.member_first_name || null,
            subscriber?.linked_last_name  || subscriber?.member_last_name  || null,
            subscriberIdentity.type,
            subscriberIdentity.value,
            subscriberIdentity.country,
            memberRow?.linked_first_name || memberRow?.member_first_name || null,
            memberRow?.linked_last_name  || memberRow?.member_last_name  || null,
            memberRow?.relationship_to_subscriber_code || null,
            memberIdentity.type,
            memberIdentity.value,
            memberIdentity.country,
            userId
        ]);
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
