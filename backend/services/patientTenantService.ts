import { 
    TenantPatient, 
    PatientContact, 
    PatientAddress, 
    PatientInsurance, 
    PatientDetail,
    CreateTenantPatientPayload,
    PatientTenantMergeEvent,
    MergeChartGroup,
    GlobalIdentityDocument // Import this model
} from '../models/patientTenant';
import { patientGlobalService } from './patientGlobalService'; 
import { identityService } from './identityService';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

export class PatientTenantService {

    // --- READ ---

    async getAllTenantPatients(tenantId: string): Promise<PatientDetail[]> {
        // Fetch Tenant Patients (Limit 100 for now)
        // Join with documents to get at least one ID (preference for CIN)
        const rows = await tenantQuery(tenantId, `
            SELECT pt.*, pd.document_number as primary_doc_number 
            FROM patients_tenant pt
            LEFT JOIN LATERAL (
                SELECT document_number 
                FROM patient_documents d 
                WHERE d.patient_id = pt.tenant_patient_id
                ORDER BY d.is_primary DESC, CASE WHEN document_type_code = 'CIN' THEN 1 ELSE 2 END ASC
                LIMIT 1
            ) pd ON true
            ORDER BY pt.created_at DESC 
            LIMIT 100
        `, []);
        
        if (rows.length === 0) return [];
        
        return rows.map(r => ({
            id: r.master_patient_id || r.tenant_patient_id, // Use master ID if linked, else tenant ID (for PROVISIONAL)
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
            // Map primary doc to identityDocuments for consistency, or we could add a 'cin' field to PatientDetail if we change the type
            identityDocuments: r.primary_doc_number ? [{
                documentType: 'CIN', // Simplified for list view
                documentNumber: r.primary_doc_number,
                issuingCountry: 'MA',
                isPrimary: true
            }] : []
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
            identityDocuments: localDocs.map(d => ({
                documentType: d.document_type_code,
                documentNumber: d.document_number,
                issuingCountry: d.issuing_country_code,
                isPrimary: d.is_primary
            }))
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

    // --- UNIVERSAL SEARCH & IMPORT ---

    async searchUniversal(tenantId: string, query: string) {
        // 1. Local Tenant Search
        const localRows = await tenantQuery(tenantId, `
            SELECT pt.*, imp.first_name, imp.last_name, imp.dob, imp.sex 
            FROM patients_tenant pt
            JOIN identity.master_patients imp ON pt.master_patient_id = imp.id
            WHERE (imp.first_name ILIKE $1 OR imp.last_name ILIKE $1 OR pt.medical_record_number ILIKE $1)
            AND pt.status = 'ACTIVE'
            LIMIT 20
        `, [`%${query}%`]);

        const localResults = localRows.map(r => ({
            source: 'LOCAL_TENANT',
            id: r.tenant_patient_id,
            firstName: r.first_name || 'Inconnu',
            lastName: r.last_name || 'Inconnu',
            dob: r.dob,
            sex: r.sex,
            ipp: r.medical_record_number,
            status: 'VERIFIED' // Local patients are effectively verified or provisional, but exist locally
        }));

        if (localResults.length > 0) return localResults;

        // 2. Local Identity Search (Patients that exist in local Identity DB but not linked to this tenant yet? Rare but possible)
        // For now, we skip to Global if not found locally.

        // 3. Global Identity Search
        try {
            const globalPatients = await identityService.searchPatients('GLOBAL', query);
            const globalResults = globalPatients.map(p => ({
                source: 'GLOBAL_IDENTITY',
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                dob: p.dob,
                sex: p.sex,
                status: 'VERIFIED'
            }));
            return globalResults;
        } catch (err) {
            console.warn("Global search failed (offline?):", err);
            return [];
        }
    }

    async importGlobalPatient(tenantId: string, globalId: string): Promise<string> {
        // 1. Fetch from Global
        const globalPatient = await identityService.getPatientById('GLOBAL', globalId);
        if (!globalPatient) throw new Error("Global patient not found");

        const globalDocs = await identityService.getPatientDocuments('GLOBAL', globalId);

        // 2. Import to Local (via createTenantPatient with VERIFIED status)
        const payload: CreateTenantPatientPayload = {
            firstName: globalPatient.firstName,
            lastName: globalPatient.lastName,
            sex: globalPatient.sex,
            dob: globalPatient.dob,
            status: 'VERIFIED',
            masterPatientId: globalPatient.id,
            identityDocuments: globalDocs.map(d => ({
                documentType: d.document_type_code,
                documentNumber: d.document_number,
                issuingCountry: d.issuing_country_code
            }))
        };

        return this.createTenantPatient(tenantId, payload);
    }

    // --- WRITE ---

    async createTenantPatient(tenantId: string, payload: CreateTenantPatientPayload): Promise<string> {
        // VALIDATION RULES
        const status = payload.status || 'PROVISIONAL'; // Default if missing, but UI should provide it
        
        if (status === 'UNKNOWN') {
            if (!payload.sex) throw new Error("SEX is required for UNKNOWN status");
            payload.firstName = payload.firstName || 'INCONNU';
            payload.lastName = payload.lastName || 'INCONNU';
        } else if (status === 'PROVISIONAL') {
            if (!payload.firstName || !payload.lastName) throw new Error("First and Last Name required for PROVISIONAL");
            if (!payload.dob && !payload.sex) throw new Error("DOB or SEX required for PROVISIONAL");
        } else if (status === 'VERIFIED') {
            if (!payload.firstName || !payload.lastName || !payload.dob || !payload.sex) throw new Error("Full identity required for VERIFIED");
            if (!payload.identityDocuments || payload.identityDocuments.length === 0) throw new Error("At least one document required for VERIFIED");
        }

        return await tenantTransaction(tenantId, async (client) => {
            // ============================================================
            // ALL WRITES USE THE SAME TRANSACTION CLIENT
            // Both identity.* and public.* schemas are in the same tenant DB.
            // If ANY step fails, everything rolls back atomically.
            // ============================================================

            // 1–2. MPI Identity Resolution
            // Before creating anything, check if any submitted document already exists.
            // If it does, reuse that master_patient_id. If not, create a new one.
            let masterId = payload.masterPatientId || null;

            if (!masterId && payload.identityDocuments && payload.identityDocuments.length > 0) {
                // Lookup: does any of the submitted documents already exist?
                for (const d of payload.identityDocuments) {
                    const existing = await client.query(`
                        SELECT master_patient_id FROM identity.master_patient_documents
                        WHERE document_type_code = $1 AND document_number = $2 AND issuing_country_code = $3
                        LIMIT 1
                    `, [d.documentType, d.documentNumber, d.issuingCountry || 'MA']);
                    if (existing.rows.length > 0) {
                        masterId = existing.rows[0].master_patient_id;
                        break; // Resolved — reuse this master patient
                    }
                }
            }

            if (!masterId) {
                // No existing identity found — create new master patient
                const identityRes = await client.query(`
                    INSERT INTO identity.master_patients (first_name, last_name, dob, sex)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [
                    payload.firstName || 'INCONNU',
                    payload.lastName || 'INCONNU',
                    payload.dob || null,
                    payload.sex || null
                ]);
                masterId = identityRes.rows[0].id;

                // Insert identity documents (only for newly created master patients)
                if (payload.identityDocuments) {
                    for (const d of payload.identityDocuments) {
                        await client.query(`
                            INSERT INTO identity.master_patient_documents 
                            (master_patient_id, document_type_code, document_number, issuing_country_code, is_primary)
                            VALUES ($1, $2, $3, $4, $5)
                        `, [masterId, d.documentType, d.documentNumber, d.issuingCountry || 'MA', d.isPrimary || false]);
                    }
                }
            }

            // 3. Generate unique MRN (IPP) — format: IPP-YYMMDD-XXXX
            const now = new Date();
            const yy = String(now.getFullYear()).slice(-2);
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const datePrefix = `${yy}${mm}${dd}`;
            
            // Count existing patients created today to get next sequence number
            const seqRes = await client.query(`
                SELECT COUNT(*)::int AS cnt FROM patients_tenant 
                WHERE medical_record_number LIKE $1
            `, [`IPP-${datePrefix}-%`]);
            const seq = (seqRes.rows[0].cnt || 0) + 1;
            const mrn = `IPP-${datePrefix}-${String(seq).padStart(4, '0')}`;

            // 4. Create Tenant Patient Record (public.patients_tenant)
            const linkRes = await client.query(`
                INSERT INTO patients_tenant 
                (tenant_id, master_patient_id, medical_record_number, first_name, last_name, dob, sex, status, mpi_link_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'LINKED')
                RETURNING tenant_patient_id
            `, [
                tenantId, 
                masterId, 
                mrn, 
                payload.firstName,
                payload.lastName,
                payload.dob,
                payload.sex,
                status
            ]);
            
            const tenantPatientId = linkRes.rows[0].tenant_patient_id;

            // 5. Patient Documents (public.patient_documents)
            if (payload.identityDocuments) {
                for (const d of payload.identityDocuments) {
                    await client.query(`
                        INSERT INTO patient_documents (patient_id, document_type_code, document_number, issuing_country_code, is_primary)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [tenantPatientId, d.documentType, d.documentNumber, d.issuingCountry || 'MA', d.isPrimary || false]);
                }
            }

            // 6. Contacts (public.patient_contacts)
            if (payload.contacts) {
                for (const c of payload.contacts) {
                    await client.query(`
                        INSERT INTO patient_contacts (tenant_patient_id, phone, email)
                        VALUES ($1, $2, $3)
                    `, [tenantPatientId, c.phone, c.email]);
                }
            }

            // 7. Addresses (public.patient_addresses)
            if (payload.addresses) {
                for (const a of payload.addresses) {
                    await client.query(`
                        INSERT INTO patient_addresses (tenant_patient_id, address_line, city, country_id)
                        VALUES ($1, $2, $3, $4)
                    `, [tenantPatientId, a.addressLine, a.city, a.countryId]);
                }
            }

            // ============================================================
            // PERSON RESOLUTION ENGINE
            // Collect all person-like blocks, deduplicate, resolve once.
            // Each real-world person is created at most once in `persons`.
            // ============================================================
            interface PersonCandidate {
                firstName: string;
                lastName: string;
                phone?: string | null;
                email?: string | null;
                document?: { typeCode: string; number: string; countryCode: string } | null;
            }

            // Key generation: document-based (strong) or name+phone (fallback)
            const docKey = (d: { typeCode: string; number: string; countryCode: string }) =>
                `DOC:${d.typeCode}|${d.number}|${d.countryCode}`.toUpperCase();
            const nameKey = (firstName: string, lastName: string, phone?: string | null) =>
                `NAME:${(firstName || '').trim().toUpperCase()}|${(lastName || '').trim().toUpperCase()}|${(phone || '').replace(/\s/g, '')}`;

            // Map: dedup key → PersonCandidate
            const personCandidates = new Map<string, PersonCandidate>();

            // Helper: register a person candidate, returns its dedup key
            const registerPerson = (p: PersonCandidate): string => {
                // Primary key: document-based if available
                let key = p.document ? docKey(p.document) : nameKey(p.firstName, p.lastName, p.phone);
                if (!personCandidates.has(key)) {
                    personCandidates.set(key, p);
                }
                return key;
            };

            // --- Collect from Legal Guardians ---
            const guardianPersonKeys: (string | null)[] = [];
            if (payload.legalGuardians) {
                for (const lg of payload.legalGuardians) {
                    if (lg.guardianType === 'EXTERNAL_PERSON' && lg.firstName && lg.lastName) {
                        const key = registerPerson({
                            firstName: lg.firstName,
                            lastName: lg.lastName,
                            phone: lg.phone,
                            email: lg.email,
                            document: null, // Guardians currently don't have document data in form
                        });
                        guardianPersonKeys.push(key);
                    } else {
                        guardianPersonKeys.push(null); // EXISTING_PATIENT — no person to create
                    }
                }
            }

            // --- Collect from Insurance Subscribers ---
            const insurancePersonKeys: (string | null)[] = [];
            if (payload.insurances) {
                for (const ins of payload.insurances) {
                    const subType = ins.subscriberType || 'PATIENT';
                    if (subType === 'PERSON' && ins.subscriberFirstName && ins.subscriberLastName) {
                        const doc = ins.subscriberDocument && ins.subscriberDocument.documentNumber
                            ? { typeCode: ins.subscriberDocument.documentTypeCode, number: ins.subscriberDocument.documentNumber, countryCode: ins.subscriberDocument.issuingCountryCode || 'MA' }
                            : null;
                        const key = registerPerson({
                            firstName: ins.subscriberFirstName,
                            lastName: ins.subscriberLastName,
                            phone: ins.subscriberPhone,
                            email: ins.subscriberEmail,
                            document: doc,
                        });
                        insurancePersonKeys.push(key);
                    } else {
                        insurancePersonKeys.push(null); // PATIENT or PATIENT_RELATION — no person to create
                    }
                }
            }

            // --- Collect from Emergency Contacts ---
            const emergencyPersonKeys: (string | null)[] = [];
            if (payload.emergencyContacts) {
                for (const ec of payload.emergencyContacts) {
                    const parts = (ec.name || '').split(' ');
                    const fn = parts[0] || '.';
                    const ln = parts.slice(1).join(' ') || '.';
                    const key = registerPerson({
                        firstName: fn,
                        lastName: ln,
                        phone: ec.phone,
                        email: null,
                        document: null,
                    });
                    emergencyPersonKeys.push(key);
                }
            }

            // --- Resolve all unique persons: lookup DB → reuse or create ---
            const resolvedPersonIds = new Map<string, string>(); // dedup key → person_id

            for (const [key, candidate] of personCandidates.entries()) {
                let personId: string | null = null;

                // Try document-based lookup first
                if (candidate.document) {
                    const existing = await client.query(`
                        SELECT person_id FROM person_documents
                        WHERE document_type_code = $1 AND document_number = $2 AND issuing_country_code = $3
                        LIMIT 1
                    `, [candidate.document.typeCode, candidate.document.number, candidate.document.countryCode]);
                    if (existing.rows.length > 0) {
                        personId = existing.rows[0].person_id;
                    }
                }

                if (!personId) {
                    // Create new person
                    const personRes = await client.query(`
                        INSERT INTO persons (tenant_id, first_name, last_name, phone, email)
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING person_id
                    `, [tenantId, candidate.firstName, candidate.lastName, candidate.phone || null, candidate.email || null]);
                    personId = personRes.rows[0].person_id;

                    // Insert person document if available
                    if (candidate.document) {
                        await client.query(`
                            INSERT INTO person_documents (person_id, document_type_code, document_number, issuing_country_code)
                            VALUES ($1, $2, $3, $4)
                        `, [personId, candidate.document.typeCode, candidate.document.number, candidate.document.countryCode]);
                    }
                }

                resolvedPersonIds.set(key, personId!);
            }

            // ============================================================
            // ROLE TABLE INSERTS — use resolved person_ids from the map
            // ============================================================

            // 8. Insurances (versioned, with subscriber entity linking)
            if (payload.insurances) {
                for (let i = 0; i < payload.insurances.length; i++) {
                    const ins = payload.insurances[i];
                    let subscriberPatientId: string | null = null;
                    let subscriberPersonId: string | null = null;
                    let subType = ins.subscriberType || 'PATIENT';
                    let subRelType = ins.subscriberRelationshipType || 'SELF';

                    if (subType === 'PATIENT') {
                        subscriberPatientId = tenantPatientId;
                        subRelType = 'SELF';
                    } else if (subType === 'PATIENT_RELATION') {
                        subscriberPatientId = ins.subscriberPatientId || null;
                    } else if (subType === 'PERSON') {
                        const personKey = insurancePersonKeys[i];
                        subscriberPersonId = personKey ? (resolvedPersonIds.get(personKey) || null) : null;
                    }

                    await client.query(`
                        INSERT INTO patient_insurances 
                        (tenant_patient_id, insurance_org_id, policy_number, plan_name, subscriber_name,
                         coverage_valid_from, coverage_valid_to, row_valid_from, row_valid_to,
                         subscriber_type, subscriber_patient_id, subscriber_person_id, subscriber_relationship_type)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL, $8, $9, $10, $11)
                    `, [
                        tenantPatientId,
                        ins.insuranceOrgId,
                        ins.policyNumber || null,
                        ins.planName || null,
                        ins.subscriberName || null,
                        ins.coverageValidFrom || null,
                        ins.coverageValidTo || null,
                        subType,
                        subscriberPatientId,
                        subscriberPersonId,
                        subRelType
                    ]);
                }
            }

            // 9. Emergency Contacts
            if (payload.emergencyContacts) {
                for (let i = 0; i < payload.emergencyContacts.length; i++) {
                    const ec = payload.emergencyContacts[i];
                    const personKey = emergencyPersonKeys[i];
                    const personId = personKey ? (resolvedPersonIds.get(personKey) || null) : null;

                    if (personId) {
                        await client.query(`
                            INSERT INTO patient_emergency_contacts (tenant_id, tenant_patient_id, related_person_id, relationship_label)
                            VALUES ($1, $2, $3, $4)
                        `, [tenantId, tenantPatientId, personId, ec.relationship]);
                    }
                }
            }

            // 10. Legal Guardians → writes to 3 tables per guardian
            if (payload.legalGuardians) {
                let guardianPriority = 0;
                for (let i = 0; i < payload.legalGuardians.length; i++) {
                    const lg = payload.legalGuardians[i];
                    guardianPriority++;
                    let relatedPersonId: string | null = null;
                    let relatedPatientId: string | null = null;

                    if (lg.guardianType === 'EXTERNAL_PERSON') {
                        const personKey = guardianPersonKeys[i];
                        relatedPersonId = personKey ? (resolvedPersonIds.get(personKey) || null) : null;
                    } else if (lg.guardianType === 'EXISTING_PATIENT') {
                        relatedPatientId = lg.relatedPatientId || null;
                    }

                    const validFrom = lg.validFrom || new Date().toISOString().split('T')[0];
                    const validTo = lg.validTo || null;

                    // A) patient_legal_guardians
                    await client.query(`
                        INSERT INTO patient_legal_guardians 
                        (tenant_id, tenant_patient_id, related_person_id, related_patient_id, legal_basis, valid_from, valid_to, is_primary)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [tenantId, tenantPatientId, relatedPersonId, relatedPatientId, lg.legalBasis || null, validFrom, validTo, lg.isPrimary || false]);

                    // B) patient_relationships
                    await client.query(`
                        INSERT INTO patient_relationships 
                        (tenant_id, subject_patient_id, related_person_id, related_patient_id, relationship_type, valid_from, valid_to)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [tenantId, tenantPatientId, relatedPersonId, relatedPatientId, lg.relationshipType, validFrom, validTo]);

                    // C) patient_decision_makers
                    await client.query(`
                        INSERT INTO patient_decision_makers 
                        (tenant_id, tenant_patient_id, related_person_id, related_patient_id, role, priority, valid_from, valid_to)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [tenantId, tenantPatientId, relatedPersonId, relatedPatientId, 'LEGAL_GUARDIAN', lg.isPrimary ? 1 : guardianPriority + 1, validFrom, validTo]);
                }
            }

            // 11. Relationships (Not implemented in form yet, but ready in backend)

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
