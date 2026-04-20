import { 
    PatientDetail,
    CreateTenantPatientPayload,
    PatientTenantMergeEvent,
    MergeChartGroup,
    PatientRelationshipLink,
    // PatientCoverage removed — coverages are now admission-level (admission_coverages)
    Coverage,
    PatientContact,
    PatientAddress,
    IdentityId
} from '../models/patientTenant';
import { identityService } from './identityService';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OutboxPayload {
    tenantId: string;
    tenantPatientId: string;
    firstName?: string;
    lastName?: string;
    dob?: string;
    sex?: string;
    identifiers?: { type: string; value: string; country?: string }[];
}

export class PatientTenantService {

    // --- READ ---

    async getAllTenantPatients(tenantId: string): Promise<PatientDetail[]> {
        console.log(`[PatientTenantService] getAllTenantPatients for ${tenantId}`);
        const rows = await tenantQuery(tenantId, `
            SELECT pt.*, 
                   mrn.identity_value as mrn_value,
                   doc.identity_value as primary_doc_value,
                   doc.identity_type_code as primary_doc_type
            FROM patients_tenant pt
            LEFT JOIN LATERAL (
                SELECT identity_value
                FROM identity_ids i
                WHERE i.tenant_patient_id = pt.tenant_patient_id
                AND i.identity_type_code = 'LOCAL_MRN'
                AND i.status = 'ACTIVE'
                LIMIT 1
            ) mrn ON true
            LEFT JOIN LATERAL (
                SELECT identity_value, identity_type_code
                FROM identity_ids i
                WHERE i.tenant_patient_id = pt.tenant_patient_id
                AND i.identity_type_code IN ('CIN', 'PASSPORT', 'CARTE_SEJOUR')
                AND i.status = 'ACTIVE'
                AND i.is_primary = true
                LIMIT 1
            ) doc ON true
            WHERE pt.lifecycle_status IN ('ACTIVE') 
            ORDER BY pt.created_at DESC 
            LIMIT 100
        `, []);
        
        return rows.map(r => ({
            id: r.tenant_patient_id, 
            tenantPatientId: r.tenant_patient_id,
            tenantId: r.tenant_id,
            firstName: r.first_name || 'Inconnu',
            lastName: r.last_name || 'Inconnu',
            dateOfBirth: r.dob, 
            gender: r.sex,
            sex: r.sex, 
            dob: r.dob, 
            createdAt: r.created_at,
            updatedAt: r.created_at,
            lifecycleStatus: r.lifecycle_status,
            identityStatus: r.identity_status,
            medicalRecordNumber: r.mrn_value,
            ipp: r.mrn_value || '',
            primaryDocType: r.primary_doc_type || undefined,
            primaryDocValue: r.primary_doc_value || undefined,
            contacts: [], 
            addresses: [],
            relationships: [],
            coverages: [],
            identifiers: []
        }));
    }

    async getTenantPatient(tenantId: string, tenantPatientId: string): Promise<PatientDetail | null> {
        // Resolve merge chain
        const resolvedId = await this.resolveActiveTenantPatientId(tenantId, tenantPatientId);
        
        // 1. Get Patient
        const rows = await tenantQuery(tenantId, `SELECT * FROM patients_tenant WHERE tenant_patient_id = $1`, [resolvedId]);
        if (!rows.length) return null;
        const pt = rows[0];

        // 2. Parallel Fetch
        const [ids, contacts, addresses, relationships, coverages] = await Promise.all([
            this.getIdentifiers(tenantId, resolvedId),
            this.getContacts(tenantId, resolvedId),
            this.getAddresses(tenantId, resolvedId),
            this.getRelationships(tenantId, resolvedId),
            this.getCoverages(tenantId, resolvedId)
        ]);

        const mrnObj = ids.find(i => i.identityTypeCode === 'LOCAL_MRN');

        return {
            id: resolvedId,
            tenantPatientId: resolvedId,
            tenantId: pt.tenant_id,
            firstName: pt.first_name,
            lastName: pt.last_name,
            dateOfBirth: pt.dob,
            dob: pt.dob,
            gender: pt.sex,
            sex: pt.sex,
            lifecycleStatus: pt.lifecycle_status,
            identityStatus: pt.identity_status,
            medicalRecordNumber: mrnObj?.identityValue,
            ipp: mrnObj?.identityValue || '', // Map to IPP
            createdAt: pt.created_at,
            updatedAt: pt.created_at,
            
            identifiers: ids,
            contacts,
            addresses,
            coverages,
            relationships
        };
    }

    // --- SUB-FETCHERS ---

    private async getIdentifiers(tenantId: string, patientId: string): Promise<IdentityId[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM identity_ids 
            WHERE tenant_patient_id = $1 AND status = 'ACTIVE'
        `, [patientId]);
        
        return rows.map(r => ({
            identityId: r.identity_id,
            tenantPatientId: r.tenant_patient_id,
            identityTypeCode: r.identity_type_code,
            identityValue: r.identity_value,
            issuingCountryCode: r.issuing_country_code,
            isPrimary: r.is_primary,
            status: r.status,
            createdAt: r.created_at
        }));
    }

    private async getContacts(tenantId: string, patientId: string): Promise<PatientContact[]> {
        try {
            const rows = await tenantQuery(tenantId, `SELECT * FROM patient_contacts WHERE tenant_patient_id = $1`, [patientId]);
            return rows.map(r => ({
                contactId: r.contact_id,
                tenantPatientId: r.tenant_patient_id,
                phone: r.phone,
                email: r.email,
                createdAt: r.created_at
            }));
        } catch (e) {
            return [];
        }
    }

    private async getAddresses(tenantId: string, patientId: string): Promise<PatientAddress[]> {
        try {
            const rows = await tenantQuery(tenantId, `SELECT * FROM patient_addresses WHERE tenant_patient_id = $1`, [patientId]);
            return rows.map(r => ({
                addressId: r.address_id,
                tenantPatientId: r.tenant_patient_id,
                addressLine: r.address_line,
                city: r.city,
                isPrimary: false 
            }));
        } catch (e) {
            return [];
        }
    }

    // Patient-level coverages: a coverage + coverage_member pair captures the patient's
    // known insurance. Admission-level coverage (admission_coverages) is a separate concept —
    // snapshotted at admission time, potentially from patient-level coverage.
    private async getCoverages(tenantId: string, patientId: string): Promise<any[]> {
        try {
            const rows = await tenantQuery(tenantId, `
                SELECT
                    c.coverage_id,
                    c.organisme_id,
                    c.policy_number,
                    c.status,
                    cm.coverage_member_id,
                    cm.relationship_to_subscriber_code
                FROM coverage_members cm
                JOIN coverages c ON c.coverage_id = cm.coverage_id
                WHERE cm.tenant_id = $1 AND cm.tenant_patient_id = $2
                ORDER BY c.created_at DESC
            `, [tenantId, patientId]);

            return rows.map(r => ({
                coverageId: r.coverage_id,
                organismeId: r.organisme_id,
                policyNumber: r.policy_number,
                status: r.status,
                members: [{
                    coverageMemberId: r.coverage_member_id,
                    relationshipToSubscriberCode: r.relationship_to_subscriber_code
                }]
            }));
        } catch (e) {
            return [];
        }
    }

    private async getRelationships(tenantId: string, patientId: string): Promise<PatientRelationshipLink[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM patient_relationship_links 
            WHERE subject_tenant_patient_id = $1
            ORDER BY priority ASC
        `, [patientId]);

        return rows.map(r => ({
            relationshipId: r.relationship_id,
            tenantId: r.tenant_id,
            subjectTenantPatientId: r.subject_tenant_patient_id,
            relatedTenantPatientId: r.related_tenant_patient_id,
            relatedFirstName: r.related_first_name,
            relatedLastName: r.related_last_name,
            relatedIdentityTypeCode: r.related_identity_type_code,
            relatedIdentityValue: r.related_identity_value,
            relatedIssuingCountryCode: r.related_issuing_country_code,
            relatedPhone: r.related_phone,
            relationshipTypeCode: r.relationship_type_code,
            isLegalGuardian: r.is_legal_guardian,
            isDecisionMaker: r.is_decision_maker,
            isEmergencyContact: r.is_emergency_contact,
            priority: r.priority,
            isPrimary: r.is_primary,
            validFrom: r.valid_from,
            validTo: r.valid_to
        }));
    }




    // importGlobalPatient removed (legacy)

    // --- HISTORY LOGGING ---

    private async logCoverageChange(
        client: any,
        tenantId: string,
        coverageId: string,
        changeType: string,
        changeSource: string,
        details: {
            memberId?: string,
            fieldName?: string,
            oldValue?: string,
            newValue?: string,
            reason?: string,
            userId?: string
        }
    ) {
        await client.query(`
            INSERT INTO coverage_change_history (
                tenant_id, coverage_id, coverage_member_id,
                change_type_code, field_name, old_value, new_value,
                change_source, changed_by_user_id, change_reason
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            tenantId, coverageId, details.memberId || null,
            changeType, details.fieldName || null, details.oldValue || null, details.newValue || null,
            changeSource, details.userId || null, details.reason || null
        ]);
    }

    // --- WRITE ---

    async createTenantPatient(tenantId: string, payload: CreateTenantPatientPayload): Promise<string> {
        return await tenantTransaction(tenantId, async (client) => {
            // 1. Create Patient Record
            const patientId = uuidv4();
            
            // 2. Insert into patients_tenant
            await client.query(`
                INSERT INTO patients_tenant (
                    tenant_patient_id, tenant_id, first_name, last_name, 
                    dob, sex, lifecycle_status, identity_status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, NOW())
            `, [
                patientId, tenantId, 
                payload.firstName, payload.lastName, 
                payload.dob, payload.sex, 
                payload.identityStatus
            ]);

            // 3. Identifiers
            let mrn: string | undefined;
            if (payload.identifiers && payload.identifiers.length > 0) {
               for (const id of payload.identifiers) {
                   await client.query(`
                       INSERT INTO identity_ids (
                           identity_id, tenant_patient_id, tenant_id,
                           identity_type_code, identity_value, issuing_country_code,
                           is_primary, status
                       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
                   `, [uuidv4(), patientId, tenantId, id.typeCode, id.value, id.issuingCountryCode, id.isPrimary || false]);
                   if (id.typeCode === 'LOCAL_MRN') {
                       mrn = id.value;
                   }
               }
            }

            // Generate MRN if not provided
            if (!mrn) {
                const now = new Date();
                const datePrefix = now.toISOString().slice(2, 10).replace(/-/g, '');
                const seqRes = await client.query(`
                    SELECT COUNT(*)::int as cnt FROM identity_ids 
                    WHERE identity_type_code = 'LOCAL_MRN' 
                    AND identity_value LIKE $1
                `, [`IPP-${datePrefix}-%`]);
                const seq = (seqRes.rows[0].cnt || 0) + 1;
                mrn = `IPP-${datePrefix}-${String(seq).padStart(4, '0')}`;

                await client.query(`
                    INSERT INTO identity_ids (identity_id, tenant_patient_id, tenant_id, identity_type_code, identity_value, is_primary, status)
                    VALUES ($1, $2, $3, 'LOCAL_MRN', $4, TRUE, 'ACTIVE')
                `, [uuidv4(), patientId, tenantId, mrn]);
            }

            // 4. Contacts
            if (payload.contacts) {
                for (const c of payload.contacts) {
                    await client.query(`
                        INSERT INTO patient_contacts (tenant_patient_id, phone, email) VALUES ($1, $2, $3)
                    `, [patientId, c.phone, c.email]);
                }
            }
            if (payload.addresses) {
                for (const a of payload.addresses) {
                    await client.query(`
                        INSERT INTO patient_addresses (tenant_patient_id, address_line, city, country_id) VALUES ($1, $2, $3, $4)
                    `, [patientId, a.addressLine, a.city, a.countryId]);
                }
            }

            // 5. Relationships (Guardians, Emergency, etc.)
            const insertRel = async (rel: any) => {
                let relatedId = rel.relatedTenantPatientId || null;
                await client.query(`
                    INSERT INTO patient_relationship_links 
                    (tenant_id, subject_tenant_patient_id, related_tenant_patient_id, 
                     related_first_name, related_last_name, related_identity_type_code, related_identity_value, related_issuing_country_code, related_phone,
                     relationship_type_code, is_legal_guardian, is_decision_maker, is_emergency_contact, is_primary)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    tenantId, patientId, relatedId,
                    rel.relatedFirstName, rel.relatedLastName, rel.relatedIdentity?.typeCode, rel.relatedIdentity?.value, rel.relatedIdentity?.countryCode, rel.relatedPhone,
                    rel.relationshipTypeCode, 
                    rel.isLegalGuardian || false, rel.isDecisionMaker || false, rel.isEmergencyContact || false, rel.isPrimary || false
                ]);
            };

            if (payload.relationships) {
                for (const r of payload.relationships) {
                    await insertRel(r);
                }
            }
            if (payload.legalGuardians) {
                for (const g of payload.legalGuardians) {
                    await insertRel({
                        relationshipTypeCode: g.relationshipType,
                        relatedTenantPatientId: g.relatedPatientId,
                        relatedFirstName: g.firstName,
                        relatedLastName: g.lastName,
                        isLegalGuardian: true,
                        isPrimary: g.isPrimary
                    });
                }
            }
            if (payload.emergencyContacts) {
                for (const ec of payload.emergencyContacts) {
                    const parts = ec.name.split(' ');
                    const fn = parts[0];
                    const ln = parts.slice(1).join(' ');
                    await insertRel({
                        relationshipTypeCode: ec.relationship || 'OTHER',
                        relatedFirstName: fn,
                        relatedLastName: ln,
                        isEmergencyContact: true
                    });
                }
            }

            // 6. Epic-Style Coverages (Master Data Only)
            if (payload.coverages && payload.coverages.length > 0) {
                for (const cov of payload.coverages) {
                    let coverageId = cov.existingCoverageId;

                    const relationshipCode = cov.relationshipToSubscriberCode;
                    const isSelf = relationshipCode === 'SELF';

                    // A. Create New Coverage if not existing
                    if (!coverageId) {
                        coverageId = uuidv4();

                        // Create coverage header — subscriber identity is tracked in coverage_members, not here
                        const subId = (!isSelf && cov.subscriber) ? cov.subscriber.identifiers?.[0] : null;
                        await client.query(`
                            INSERT INTO coverages (
                                coverage_id, tenant_id, organisme_id, policy_number, status,
                                subscriber_first_name, subscriber_last_name,
                                subscriber_identity_type, subscriber_identity_value, subscriber_issuing_country
                            ) VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, $8, $9)
                        `, [
                            coverageId, tenantId, cov.insuranceOrgId, cov.policyNumber,
                            isSelf ? null : (cov.subscriber?.firstName || null),
                            isSelf ? null : (cov.subscriber?.lastName || null),
                            subId?.typeCode || null, subId?.value || null, subId?.countryCode || null
                        ]);

                        // Log History
                        await this.logCoverageChange(client, tenantId, coverageId, 'CREATE_COVERAGE', 'USER_UI', {
                            newValue: `Org: ${cov.insuranceOrgId}, Policy: ${cov.policyNumber}`
                        });
                    }

                    // B. Add the Patient as a Member
                    const memberId = uuidv4();
                    await client.query(`
                        INSERT INTO coverage_members (
                            coverage_member_id, tenant_id, coverage_id,
                            tenant_patient_id, relationship_to_subscriber_code
                        ) VALUES ($1, $2, $3, $4, $5)
                    `, [memberId, tenantId, coverageId, patientId, relationshipCode]);

                   // Log Member Add
                   await this.logCoverageChange(client, tenantId, coverageId as string, 'ADD_MEMBER', 'USER_UI', {
                       memberId,
                       newValue: `Patient ${patientId} as ${relationshipCode}`
                   });
                   
                   // C. Add the Subscriber as a separate Member row (relationship = SELF) when subscriber != patient.
                   //    Guards:
                   //      - Skip if a SELF already exists on this coverage (prevents phantom duplicates when
                   //        the clerk picks an existing coverage that already has its subscriber recorded).
                   //      - Skip if subscriber payload is effectively empty (no linked patient + no name fields).
                   if (relationshipCode !== 'SELF' && cov.subscriber) {
                       const existingSelf = await client.query(`
                           SELECT coverage_member_id FROM coverage_members
                           WHERE tenant_id = $1 AND coverage_id = $2 AND relationship_to_subscriber_code = 'SELF'
                           LIMIT 1
                       `, [tenantId, coverageId]);

                       const hasPayload = !!cov.subscriber.tenantPatientId
                           || (cov.subscriber.firstName && cov.subscriber.firstName.trim())
                           || (cov.subscriber.lastName  && cov.subscriber.lastName.trim());

                       if (existingSelf.rows.length === 0 && hasPayload) {
                           const subscriberMemberId = uuidv4();
                           const subId = cov.subscriber.identifiers?.[0];

                           await client.query(`
                               INSERT INTO coverage_members (
                                   coverage_member_id, tenant_id, coverage_id,
                                   tenant_patient_id, relationship_to_subscriber_code,
                                   member_first_name, member_last_name,
                                   member_identity_type, member_identity_value, member_issuing_country
                               ) VALUES ($1, $2, $3, $4, 'SELF', $5, $6, $7, $8, $9)
                           `, [
                               subscriberMemberId, tenantId, coverageId,
                               cov.subscriber.tenantPatientId || null,
                               cov.subscriber.firstName || null,
                               cov.subscriber.lastName || null,
                               subId?.typeCode || null,
                               subId?.value || null,
                               subId?.countryCode || null
                           ]);

                           await this.logCoverageChange(client, tenantId, coverageId as string, 'ADD_MEMBER', 'USER_UI', {
                               memberId: subscriberMemberId,
                               newValue: `Subscriber ${cov.subscriber.firstName || ''} ${cov.subscriber.lastName || ''} as SELF`
                           });
                       }
                   }
                }
            }
            // patient_coverages INSERT removed — coverages are linked during admission creation
            // The coverageId + coverageMember records are still created; admission_coverages link happens at admission time.

            // 7. Identity Sync Outbox
            const outboxPayload: OutboxPayload = {
                tenantId,
                tenantPatientId: patientId,
                firstName: payload.firstName,
                lastName: payload.lastName,
                dob: payload.dob,
                sex: payload.sex,
                identifiers: payload.identifiers?.map(i => ({ type: i.typeCode, value: i.value, country: i.issuingCountryCode })),
            };
            outboxPayload.identifiers = [...(outboxPayload.identifiers || []), { type: 'LOCAL_MRN', value: mrn }];

            const dedupeKey = `PATIENT_UPSERT:${tenantId}:${patientId}:${new Date().getTime()}`;
            
            await client.query(`
                INSERT INTO identity_sync.outbox_events 
                (tenant_id, event_type, entity_type, entity_id, payload, dedupe_key)
                VALUES ($1, 'PATIENT_UPSERT', 'patients_tenant', $2, $3, $4)
            `, [tenantId, patientId, JSON.stringify(outboxPayload), dedupeKey]);

            return patientId;
        });
    }

    // --- SEARCH ---

    async searchCoverages(tenantId: string, organismeId: string, policyNumber: string): Promise<any[]> {
        // Joins the SELF coverage_member (if any) so callers can display the existing subscriber
        // and pre-fill / lock the subscriber fields when the clerk attaches a dependent to this
        // existing coverage.
        const rows = await tenantQuery(tenantId, `
            SELECT
                c.coverage_id, c.tenant_id, c.organisme_id, c.policy_number, c.group_number,
                c.plan_name, c.coverage_type_code, c.effective_from, c.effective_to, c.status,
                o.designation AS organisme_name,
                self_cm.coverage_member_id      AS self_member_id,
                self_cm.tenant_patient_id       AS self_tenant_patient_id,
                self_cm.member_first_name       AS self_member_first_name,
                self_cm.member_last_name        AS self_member_last_name,
                self_cm.member_identity_type    AS self_member_identity_type,
                self_cm.member_identity_value   AS self_member_identity_value,
                self_cm.member_issuing_country  AS self_member_issuing_country,
                self_pt.first_name              AS self_patient_first_name,
                self_pt.last_name               AS self_patient_last_name
            FROM coverages c
            JOIN reference.organismes o ON o.id = c.organisme_id
            LEFT JOIN LATERAL (
                SELECT * FROM coverage_members cm
                WHERE cm.tenant_id = c.tenant_id
                  AND cm.coverage_id = c.coverage_id
                  AND cm.relationship_to_subscriber_code = 'SELF'
                LIMIT 1
            ) self_cm ON TRUE
            LEFT JOIN patients_tenant self_pt ON self_pt.tenant_patient_id = self_cm.tenant_patient_id
            WHERE c.tenant_id = $1
              AND c.organisme_id = $2
              AND c.policy_number ILIKE $3
              AND c.status = 'ACTIVE'
        `, [tenantId, organismeId, policyNumber]);

        return rows.map((r: any) => ({
            coverageId: r.coverage_id,
            tenantId: r.tenant_id,
            organismeId: r.organisme_id,
            organismeName: r.organisme_name,
            policyNumber: r.policy_number,
            groupNumber: r.group_number,
            planName: r.plan_name,
            coverageTypeCode: r.coverage_type_code,
            effectiveFrom: r.effective_from,
            effectiveTo: r.effective_to,
            status: r.status,
            hasSelfMember: !!r.self_member_id,
            selfMemberId: r.self_member_id,
            selfTenantPatientId: r.self_tenant_patient_id,
            subscriberFirstName: r.self_patient_first_name || r.self_member_first_name || '',
            subscriberLastName:  r.self_patient_last_name  || r.self_member_last_name  || '',
            subscriberIdentityType:    r.self_member_identity_type    || null,
            subscriberIdentityValue:   r.self_member_identity_value   || null,
            subscriberIssuingCountry:  r.self_member_issuing_country  || null
        }));
    }

    async searchUniversal(tenantId: string, query: string): Promise<any[]> {
         // Search patients_tenant + identity_ids only (no global identity search)
         const localRows = await tenantQuery(tenantId, `
            SELECT pt.tenant_patient_id, pt.first_name, pt.last_name, pt.dob, pt.sex,
                   MAX(CASE WHEN id.identity_type_code = 'LOCAL_MRN' THEN id.identity_value END) as mrn,
                   jsonb_agg(
                       jsonb_build_object(
                           'typeCode', id.identity_type_code,
                           'value', id.identity_value,
                           'issuingCountry', id.issuing_country_code
                       ) ORDER BY id.is_primary DESC
                   ) FILTER (WHERE id.identity_type_code != 'LOCAL_MRN' OR id.identity_type_code IS NULL) as identifiers
            FROM patients_tenant pt
            LEFT JOIN identity_ids id ON id.tenant_patient_id = pt.tenant_patient_id AND id.status = 'ACTIVE'
            WHERE (pt.first_name ILIKE $1 OR pt.last_name ILIKE $1 
                   OR id.identity_value ILIKE $1)
            AND pt.lifecycle_status = 'ACTIVE'
            GROUP BY pt.tenant_patient_id
            ORDER BY pt.tenant_patient_id
            LIMIT 20
         `, [`%${query}%`]);

         return localRows.map(r => ({
             source: 'LOCAL_TENANT',
             id: r.tenant_patient_id,
             firstName: r.first_name,
             lastName: r.last_name,
             dob: r.dob,
             sex: r.sex,
             ipp: r.mrn,
             identifiers: r.identifiers || []
         }));
    }

    // --- UPDATE (with patient_identity_change tracking) ---

    async updateTenantPatient(
        tenantId: string,
        tenantPatientId: string,
        payload: CreateTenantPatientPayload,
        userId?: string
    ): Promise<string> {
        return await tenantTransaction(tenantId, async (client) => {
            // 1. Fetch current patient
            const curRes = await client.query(
                `SELECT first_name, last_name, dob::text, sex FROM patients_tenant WHERE tenant_patient_id = $1`,
                [tenantPatientId]
            );
            if (curRes.rows.length === 0) throw new Error('Patient not found');
            const current = curRes.rows[0];

            // 2. Track demographic changes
            const demoFields: { field: string; dbCol: string; newVal: string | undefined }[] = [
                { field: 'first_name', dbCol: 'first_name', newVal: payload.firstName },
                { field: 'last_name',  dbCol: 'last_name',  newVal: payload.lastName },
                { field: 'dob',        dbCol: 'dob',        newVal: payload.dob },
                { field: 'sex',        dbCol: 'sex',        newVal: payload.sex },
            ];

            for (const f of demoFields) {
                const oldVal = (current[f.dbCol] || '').substring(0, 10) || null;
                const newVal = (f.newVal || '').substring(0, 10) || null;
                if (oldVal !== newVal) {
                    await client.query(`
                        INSERT INTO patient_identity_change 
                        (tenant_id, tenant_patient_id, changed_by_user_id, change_source, field_path, old_value, new_value)
                        VALUES ($1, $2, $3, 'USER_EDIT', $4, $5, $6)
                    `, [tenantId, tenantPatientId, userId || null, f.field, oldVal, newVal]);
                }
            }

            // 3. Update demographics + identity_status
            await client.query(`
                UPDATE patients_tenant SET 
                    first_name = $1, last_name = $2, dob = $3, sex = $4,
                    identity_status = $5
                WHERE tenant_patient_id = $6
            `, [payload.firstName, payload.lastName, payload.dob || null, payload.sex || null, payload.identityStatus, tenantPatientId]);

            // 4. Identity Documents — track changes & upsert
            if (payload.identifiers) {
                // Get current non-MRN identifiers
                const curIds = await client.query(
                    `SELECT identity_id, identity_type_code, identity_value, issuing_country_code 
                     FROM identity_ids WHERE tenant_patient_id = $1 AND identity_type_code != 'LOCAL_MRN'`,
                    [tenantPatientId]
                );

                // Build lookup of current IDs by identity_id for change comparison
                const currentIdMap = new Map(curIds.rows.map((r: any) => [r.identity_id, r]));
                const processedIds = new Set<string>();

                for (const newId of payload.identifiers) {
                    // Try to find existing record by type+value match, or first matching type
                    const existing = curIds.rows.find((r: any) => 
                        r.identity_type_code === newId.typeCode && r.identity_value === newId.value
                    ) || curIds.rows.find((r: any) => 
                        r.identity_type_code === newId.typeCode && !processedIds.has(r.identity_id)
                    );

                    if (existing) {
                        processedIds.add(existing.identity_id);
                        // Check if value changed
                        if (existing.identity_value !== newId.value) {
                            await client.query(`
                                INSERT INTO patient_identity_change 
                                (tenant_id, tenant_patient_id, changed_by_user_id, change_source, field_path, old_value, new_value)
                                VALUES ($1, $2, $3, 'USER_EDIT', $4, $5, $6)
                            `, [tenantId, tenantPatientId, userId || null, 
                                `identity_ids.${newId.typeCode}`, existing.identity_value, newId.value]);
                        }
                        // Update existing record
                        await client.query(`
                            UPDATE identity_ids SET identity_value = $1, issuing_country_code = $2, 
                                   is_primary = $3, updated_at = now()
                            WHERE identity_id = $4
                        `, [newId.value, newId.issuingCountryCode || null, newId.isPrimary || false, existing.identity_id]);
                    } else {
                        // New identifier — insert
                        await client.query(`
                            INSERT INTO identity_ids (tenant_id, tenant_patient_id, identity_type_code, identity_value, issuing_country_code, is_primary)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [tenantId, tenantPatientId, newId.typeCode, newId.value, newId.issuingCountryCode || null, newId.isPrimary || false]);

                        // Track as new addition
                        await client.query(`
                            INSERT INTO patient_identity_change 
                            (tenant_id, tenant_patient_id, changed_by_user_id, change_source, field_path, old_value, new_value)
                            VALUES ($1, $2, $3, 'USER_EDIT', $4, NULL, $5)
                        `, [tenantId, tenantPatientId, userId || null, `identity_ids.${newId.typeCode}`, newId.value]);
                    }
                }

                // Delete identifiers that were removed (not in payload)
                const currentIdMapEntries = Array.from(currentIdMap.entries());
                for (const [idId, row] of currentIdMapEntries) {
                    if (!processedIds.has(idId as string)) {
                        const r = row as any;
                        await client.query(`DELETE FROM identity_ids WHERE identity_id = $1`, [idId]);
                        await client.query(`
                            INSERT INTO patient_identity_change 
                            (tenant_id, tenant_patient_id, changed_by_user_id, change_source, field_path, old_value, new_value)
                            VALUES ($1, $2, $3, 'USER_EDIT', $4, $5, NULL)
                        `, [tenantId, tenantPatientId, userId || null, `identity_ids.${r.identity_type_code}`, r.identity_value]);
                    }
                }
            }

            // 5. Contacts — upsert (replace)
            if (payload.contacts && payload.contacts.length > 0) {
                await client.query(`DELETE FROM patient_contacts WHERE tenant_patient_id = $1`, [tenantPatientId]);
                for (const c of payload.contacts) {
                    await client.query(`
                        INSERT INTO patient_contacts (tenant_patient_id, phone, email) VALUES ($1, $2, $3)
                    `, [tenantPatientId, c.phone, c.email]);
                }
            }

            // 6. Addresses — upsert (replace)
            if (payload.addresses && payload.addresses.length > 0) {
                await client.query(`DELETE FROM patient_addresses WHERE tenant_patient_id = $1`, [tenantPatientId]);
                for (const a of payload.addresses) {
                    await client.query(`
                        INSERT INTO patient_addresses (tenant_patient_id, address_line, city, country_id) VALUES ($1, $2, $3, $4)
                    `, [tenantPatientId, a.addressLine, a.city, a.countryId]);
                }
            }

            // 7. Relationships (guardians, emergency contacts) — upsert (replace)
            if (payload.relationships) {
                await client.query(`DELETE FROM patient_relationship_links WHERE subject_tenant_patient_id = $1`, [tenantPatientId]);
                for (const rel of payload.relationships) {
                    await client.query(`
                        INSERT INTO patient_relationship_links 
                        (tenant_id, subject_tenant_patient_id, related_tenant_patient_id, 
                         related_first_name, related_last_name, related_identity_type_code, related_identity_value, related_issuing_country_code, related_phone,
                         relationship_type_code, is_legal_guardian, is_decision_maker, is_emergency_contact, is_primary)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    `, [
                        tenantId, tenantPatientId, rel.relatedTenantPatientId || null,
                        rel.relatedFirstName, rel.relatedLastName, rel.relatedIdentity?.typeCode, rel.relatedIdentity?.value, rel.relatedIdentity?.countryCode, rel.relatedPhone,
                        rel.relationshipTypeCode, 
                        rel.isLegalGuardian || false, rel.isDecisionMaker || false, rel.isEmergencyContact || false, rel.isPrimary || false
                    ]);
                }
            }

            // 8. Coverages — upsert-diff semantics. payload.coverages (if defined) is the complete
            // new set of coverage memberships for this patient. We UPSERT each entry to keep
            // coverage_member_id stable (admission_coverages.coverage_member_id FK stays valid),
            // then DELETE only memberships the clerk actually removed.
            // Empty array = self-pay. Undefined = partial update, leave coverages untouched.
            if (payload.coverages !== undefined) {
                const keptCoverageIds: string[] = [];

                for (const cov of payload.coverages) {
                    if (!cov.insuranceOrgId) continue;

                    // Resolve or create the shared coverage row (by organisme + policy)
                    let coverageId: string;
                    const covExist = await client.query(`
                        SELECT coverage_id FROM coverages
                        WHERE tenant_id = $1 AND organisme_id = $2 AND policy_number = $3
                    `, [tenantId, cov.insuranceOrgId, cov.policyNumber]);

                    if (covExist.rows.length > 0) {
                        coverageId = covExist.rows[0].coverage_id;
                    } else {
                        const newCov = await client.query(`
                            INSERT INTO coverages (tenant_id, organisme_id, policy_number, status)
                            VALUES ($1, $2, $3, 'ACTIVE')
                            RETURNING coverage_id
                        `, [tenantId, cov.insuranceOrgId, cov.policyNumber]);
                        coverageId = newCov.rows[0].coverage_id;
                    }

                    // UPSERT the patient's membership in this coverage — preserves coverage_member_id
                    // on unchanged rows so admission_coverages FK stays intact.
                    await client.query(`
                        INSERT INTO coverage_members
                            (tenant_id, coverage_member_id, coverage_id, tenant_patient_id, relationship_to_subscriber_code)
                        VALUES ($1, gen_random_uuid(), $2, $3, $4)
                        ON CONFLICT (coverage_id, tenant_patient_id)
                        DO UPDATE SET relationship_to_subscriber_code = EXCLUDED.relationship_to_subscriber_code
                    `, [tenantId, coverageId, tenantPatientId, cov.relationshipToSubscriberCode]);

                    keptCoverageIds.push(coverageId);
                }

                // Remove memberships the clerk took out of the form. If a removed coverage is
                // still referenced by an admission binding, the RESTRICT FK will throw and the
                // whole transaction rolls back — surface that to the clerk so they know.
                if (keptCoverageIds.length > 0) {
                    await client.query(`
                        DELETE FROM coverage_members
                        WHERE tenant_id = $1
                          AND tenant_patient_id = $2
                          AND coverage_id <> ALL($3::uuid[])
                    `, [tenantId, tenantPatientId, keptCoverageIds]);
                } else {
                    await client.query(`
                        DELETE FROM coverage_members
                        WHERE tenant_id = $1 AND tenant_patient_id = $2
                    `, [tenantId, tenantPatientId]);
                }
            }

            // 9. Identity Sync Outbox
            const outboxPayload = {
                tenantId,
                tenantPatientId,
                firstName: payload.firstName,
                lastName: payload.lastName,
                dob: payload.dob,
                sex: payload.sex,
                identifiers: payload.identifiers?.map(i => ({ type: i.typeCode, value: i.value, country: i.issuingCountryCode })),
            };

            const dedupeKey = `PATIENT_UPSERT:${tenantId}:${tenantPatientId}:${new Date().getTime()}`;
            
            await client.query(`
                INSERT INTO identity_sync.outbox_events 
                (tenant_id, event_type, entity_type, entity_id, payload, dedupe_key)
                VALUES ($1, 'PATIENT_UPSERT', 'patients_tenant', $2, $3, $4)
            `, [tenantId, tenantPatientId, JSON.stringify(outboxPayload), dedupeKey]);

            return tenantPatientId;
        });
    }


     // --- MERGE ---
     
    async resolveActiveTenantPatientId(tenantId: string, tenantPatientId: string): Promise<string> {
         const rows = await tenantQuery(tenantId, `
             SELECT lifecycle_status, merged_into_tenant_patient_id 
             FROM patients_tenant WHERE tenant_patient_id = $1
         `, [tenantPatientId]);

         if (rows.length && rows[0].lifecycle_status === 'MERGED' && rows[0].merged_into_tenant_patient_id) {
             return this.resolveActiveTenantPatientId(tenantId, rows[0].merged_into_tenant_patient_id); 
         }
         return tenantPatientId;
    }

    async mergeTenantPatients(
        tenantId: string,
        sourceId: string,
        targetId: string,
        reason?: string,
        userId?: string
    ): Promise<PatientTenantMergeEvent> {
        return await tenantTransaction(tenantId, async (client) => {
            const sourceRows = await client.query(
                `SELECT tenant_patient_id, tenant_id, status FROM patients_tenant WHERE tenant_patient_id = $1`,
                [sourceId]
            );
            const targetRows = await client.query(
                `SELECT tenant_patient_id, tenant_id, lifecycle_status FROM patients_tenant WHERE tenant_patient_id = $1`,
                [targetId]
            );

            if (!sourceRows.rows.length) throw new Error(`Source chart ${sourceId} not found`);
            if (!targetRows.rows.length) throw new Error(`Target chart ${targetId} not found`);

            const source = sourceRows.rows[0];
            const target = targetRows.rows[0];

            if (source.tenant_id !== target.tenant_id) throw new Error('Cannot merge charts from different tenants');
            if (source.lifecycle_status !== 'ACTIVE') throw new Error(`Source chart lifecycle_status is '${source.lifecycle_status}', must be 'ACTIVE'`);
            if (target.lifecycle_status !== 'ACTIVE') throw new Error(`Target chart lifecycle_status is '${target.lifecycle_status}', must be 'ACTIVE'`);

            const eventRes = await client.query(`
                INSERT INTO patient_tenant_merge_events 
                (tenant_id, source_tenant_patient_id, target_tenant_patient_id, reason, merged_by_user_id)
                VALUES ($1::uuid, $2, $3, $4, $5)
                RETURNING *
            `, [tenantId, sourceId, targetId, reason || null, userId || null]);

            await client.query(`
                UPDATE patients_tenant 
                SET lifecycle_status = 'MERGED', merged_into_tenant_patient_id = $1
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

    async findDuplicateCharts(tenantId: string): Promise<MergeChartGroup[]> {
        // Simplified: return empty or usage fuzzy match on name/DOB?
        // Since master_patient_id is gone from tenants, we can't usage it.
        // For now, let's return [] or implement naive match.
        // We'll return [] to avoid breaking the API contract, waiting for EMPI dedupe.
        return [];
    }

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
