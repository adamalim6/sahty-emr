import { tenantQuery, tenantTransaction } from '../../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import { hprimOutboundService } from '../integrations/hprim/hprimOutboundService';

function generateSpecimenBarcode() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = nanoid(6).toUpperCase();
    return `SHTY-${date}-${random}`;
}

export const limsExecutionService = {
    /**
     * Creates new lab_requests for a chosen patient and admission.
     * Also anchors the financial aspect inside admission_acts.
     */
    async createLabRequests(
        tenantId: string,
        payload: {
            tenantPatientId: string;
            admissionId: string;
            globalActIds: string[];
        },
        userId: string
    ) {
        if (!payload.tenantPatientId || !payload.admissionId || !payload.globalActIds || payload.globalActIds.length === 0) {
            throw new Error("Missing required fields: tenantPatientId, admissionId, globalActIds");
        }

        return await tenantTransaction(tenantId, async (client) => {
            const labRequestIds: string[] = [];

            for (const actId of payload.globalActIds) {
                const labRequestId = uuidv4();
                
                // 1. Insert Lab Request
                await client.query(`
                    INSERT INTO lab_requests (
                        id, tenant_patient_id, admission_id,
                        global_act_id,
                        created_by_user_id, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, NOW()
                    )
                `, [labRequestId, payload.tenantPatientId, payload.admissionId, actId, userId]);

                // 2. Insert Billing Anchor (admission_acts)
                await client.query(`
                    INSERT INTO admission_acts (
                        id, admission_id, global_act_id, 
                        lab_request_id, quantity, created_at
                    ) VALUES (
                        $1, $2, $3, $4, 1, NOW()
                    )
                `, [uuidv4(), payload.admissionId, actId, labRequestId]);

                labRequestIds.push(labRequestId);
            }

            return { labRequestIds };
        });
    },

    async getActiveWalkinAdmission(tenantId: string, patientId: string) {
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM admissions
            WHERE tenant_patient_id = $1
            AND (admission_type = 'LAB_WALKIN' OR admission_type = 'LABO')
            AND status = 'En cours'
            ORDER BY admission_date DESC
            LIMIT 1
        `, [patientId]);
        return rows[0] || null;
    },

    /**
     * Reusable grouping logic used by both LIMS reception and ICU Surveillance.
     */
    async _buildCollectionRequirementsGroups(tenantId: string, joinConditionSQL: string, values: any[], filter: 'pending' | 'all' = 'pending') {
        // When filter=pending, exclude lab_requests already linked to a non-rejected specimen
        const pendingFilter = filter === 'pending'
            ? `AND NOT EXISTS (
                    SELECT 1 FROM public.lab_specimen_requests lsr2
                    JOIN public.lab_specimens s2 ON s2.id = lsr2.specimen_id
                    WHERE lsr2.lab_request_id = lr.id AND s2.status != 'REJECTED'
               )`
            : '';

        const rows = await tenantQuery(tenantId, `
            SELECT
               lr.id as lab_request_id,
               lr.admission_id,
               lr.created_at as requested_at,
               pe.id as prescription_event_id,
               ga.libelle_sih as lab_request_name,
               lasc.specimen_type_id,
               lst.libelle as specimen_label,
               lasc.container_type_id,
               lct.libelle as container_label,
               lct.tube_color as container_color,
               COALESCE(lasc.id, lr.global_act_id) as target_lsct_id,
               lsr.id as existing_link_id
            FROM public.lab_requests lr
            LEFT JOIN public.prescription_events pe ON pe.id = lr.prescription_event_id
            JOIN reference.global_actes ga ON ga.id = lr.global_act_id
            LEFT JOIN lab_act_specimen_containers lasc
                 ON lasc.global_act_id = lr.global_act_id AND lasc.actif = true
            LEFT JOIN reference.lab_specimen_types lst ON lst.id = lasc.specimen_type_id
            LEFT JOIN reference.lab_container_types lct ON lct.id = lasc.container_type_id
            LEFT JOIN public.lab_specimen_requests lsr
                 ON lsr.lab_request_id = lr.id
                 AND (lasc.id IS NULL OR EXISTS (
                    SELECT 1 FROM public.lab_specimens s
                    WHERE s.id = lsr.specimen_id
                    AND s.lab_act_specimen_container_id = lasc.id
                 ))
            ${joinConditionSQL}
            ${pendingFilter}
            ORDER BY lr.admission_id, lasc.sort_order ASC NULLS LAST
        `, values);

        // Aggregate by [admission_id + specimen_type_id + container_type_id]
        const map = new Map<string, any>();
        rows.forEach((r: any) => {
            const key = `${r.admission_id}_${r.specimen_type_id}_${r.container_type_id}`;
            if (!map.has(key)) {
                map.set(key, {
                    admission_id: r.admission_id,
                    specimen_type_id: r.specimen_type_id,
                    container_type_id: r.container_type_id,
                    target_lsct_id: r.target_lsct_id,
                    specimen_label: r.specimen_label,
                    container_label: r.container_label,
                    container_color: r.container_color,
                    lab_requests: [],
                    is_collected: true,
                });
            }

            const group = map.get(key);
            group.lab_requests.push({
                id: r.lab_request_id,
                prescription_event_id: r.prescription_event_id,
                name: r.lab_request_name,
                requested_at: r.requested_at,
                is_collected: !!r.existing_link_id
            });
            if (!r.existing_link_id) group.is_collected = false;
        });

        return Array.from(map.values());
    },

    /**
     * Resolves the required physical specimens and their linked acts for a walk-in admission.
     */
    async getCollectionRequirements(tenantId: string, admissionId: string, filter: 'pending' | 'all' = 'pending') {
        return this._buildCollectionRequirementsGroups(
            tenantId,
            "WHERE lr.admission_id = $1 AND (pe.status = 'ACTIVE' OR lr.prescription_event_id IS NULL)",
            [admissionId],
            filter
        );
    },

    /**
     * Get full collection detail for a specific lab_request (4-hop trace).
     */
    async getLabRequestCollectionDetail(tenantId: string, labRequestId: string) {
        const rows = await tenantQuery(tenantId, `
            SELECT
                lr.id as lab_request_id,
                lr.created_at as requested_at,
                ga.libelle_sih as act_name,
                s.id as specimen_id,
                s.barcode,
                s.status as specimen_status,
                s.created_at as collected_at,
                s.received_at,
                s.rejected_at,
                s.rejected_reason,
                lc.id as collection_id,
                lc.collected_at as collection_date,
                au.display_name as collected_by
            FROM public.lab_requests lr
            JOIN reference.global_actes ga ON ga.id = lr.global_act_id
            LEFT JOIN public.lab_specimen_requests lsr ON lsr.lab_request_id = lr.id
            LEFT JOIN public.lab_specimens s ON s.id = lsr.specimen_id
            LEFT JOIN public.lab_collection_specimens lcs ON lcs.specimen_id = s.id
            LEFT JOIN public.lab_collections lc ON lc.id = lcs.lab_collection_id
            LEFT JOIN auth.users au ON au.user_id = lc.collected_by_user_id
            WHERE lr.id = $1
            ORDER BY s.created_at DESC
        `, [labRequestId]);
        return rows;
    },

    async getSurveillanceCandidates(tenantId: string, prescriptionEventId: string) {
        // Find anchor
        const rows = await tenantQuery(tenantId, `
            SELECT admission_id 
            FROM prescription_events 
            WHERE id = $1
        `, [prescriptionEventId]);
        
        if (rows.length === 0) throw new Error("Prescription event not found");
        const anchor = rows[0];

        // We fetch candidates directly using the engine query to find all surrounding lab_requests
        // Replicating time math inside SQL avoids NodeJS local timezone offset bugs (+3600s in Morocco)
        const joinConditionSQL = `
            JOIN public.prescription_events anchor_pe ON anchor_pe.id = $2
            WHERE lr.admission_id = $1 
            AND pe.status = 'ACTIVE'
            AND ABS(EXTRACT(EPOCH FROM (pe.scheduled_at - anchor_pe.scheduled_at))) <= 2700 -- 45 minutes
            -- No recollection blocking: biology allows unlimited collection attempts
        `;

        const groups = await this._buildCollectionRequirementsGroups(tenantId, joinConditionSQL, [anchor.admission_id, prescriptionEventId]);
        
        // Also get individual active acts to populate the left panel precisely
        const candidateEventsSql = `
            SELECT 
                pe.id as prescription_event_id,
                ga.libelle_sih as act_name,
                pe.scheduled_at
            FROM public.lab_requests lr
            JOIN public.prescription_events pe ON pe.id = lr.prescription_event_id
            JOIN reference.global_actes ga ON ga.id = lr.global_act_id
            ${joinConditionSQL}
            ORDER BY pe.scheduled_at ASC
        `;
        const candidateEvents = await tenantQuery(tenantId, candidateEventsSql, [anchor.admission_id, prescriptionEventId]);

        // Resolve patient info (name + IPP) for label printing
        let patientInfo = { first_name: '', last_name: '', ipp: '' };
        if (anchor.admission_id) {
            const ptRows = await tenantQuery(tenantId, `
                SELECT pt.first_name, pt.last_name, 
                       (SELECT ii.identity_value FROM identity_ids ii 
                        WHERE ii.tenant_patient_id = pt.tenant_patient_id 
                        AND ii.identity_type_code = 'LOCAL_MRN' 
                        AND ii.is_primary = true 
                        LIMIT 1) as ipp
                FROM admissions a
                JOIN patients_tenant pt ON pt.tenant_patient_id = a.tenant_patient_id
                WHERE a.id = $1
            `, [anchor.admission_id]);
            if (ptRows.length > 0) {
                patientInfo = { first_name: ptRows[0].first_name || '', last_name: ptRows[0].last_name || '', ipp: ptRows[0].ipp || '' };
            }
        }

        // Fetch prior collections for these candidate events (for the history/recollection UI)
        const candidateEventIds = candidateEvents.map((e: any) => e.prescription_event_id);
        let priorCollections: any[] = [];
        if (candidateEventIds.length > 0) {
            priorCollections = await tenantQuery(tenantId, `
                SELECT ae.id as admin_event_id, ae.prescription_event_id, ae.occurred_at, ae.status as admin_status,
                       ae.performed_by_first_name, ae.performed_by_last_name,
                       lc.id as collection_id, lc.collected_at,
                       ls.id as specimen_id, ls.barcode, ls.status as specimen_status, ls.rejected_reason,
                       ct.libelle as container_name, ct.tube_color as container_color
                FROM administration_events ae
                JOIN administration_event_lab_collections aelc ON aelc.administration_event_id = ae.id
                JOIN lab_collections lc ON lc.id = aelc.lab_collection_id
                JOIN lab_collection_specimens lcs ON lcs.lab_collection_id = lc.id
                JOIN lab_specimens ls ON ls.id = lcs.specimen_id
                LEFT JOIN lab_act_specimen_containers lasc2 ON lasc2.id = ls.lab_act_specimen_container_id
                LEFT JOIN reference.lab_container_types ct ON ct.id = lasc2.container_type_id
                WHERE ae.prescription_event_id = ANY($1)
                  AND ae.status = 'ACTIVE'
                ORDER BY ae.occurred_at DESC
            `, [candidateEventIds]);
        }

        return {
            anchor_event: { id: prescriptionEventId },
            candidate_events: candidateEvents,
            suggested_specimens: groups,
            patient_info: patientInfo,
            prior_collections: priorCollections
        };
    },

    async createBiologySpecimensTx(
        tenantId: string,
        client: any,
        userId: string,
        payload: {
            anchor_prescription_event_id: string;
            mappedEvents: { prescription_event_id: string; administration_event_id: string }[];
            collected_at?: Date;
        }
    ) {
        if (!payload.mappedEvents || payload.mappedEvents.length === 0) {
            throw new Error("No events selected for biology specimens");
        }

        const labCollectionId = uuidv4();
        const prescriptionEventIds = payload.mappedEvents.map(m => m.prescription_event_id);
        
        // Track required data
        const lrResult = await client.query(`
            SELECT lr.id, lr.prescription_event_id, lr.global_act_id, lr.admission_id, lr.tenant_patient_id
            FROM public.lab_requests lr
            WHERE lr.prescription_event_id = ANY($1)
        `, [prescriptionEventIds]);
        
        if (lrResult.rows.length === 0) throw new Error("No linked lab requests found");
        const admissionId = lrResult.rows[0].admission_id;
        const patientId = lrResult.rows[0].tenant_patient_id;

        // 1. Create Core Lab Collection
        await client.query(`
            INSERT INTO public.lab_collections (
                id, tenant_patient_id, admission_id,
                collected_by_user_id, collected_at
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            labCollectionId, patientId, admissionId,
            userId, payload.collected_at ? new Date(payload.collected_at) : new Date()
        ]);

        // Compute groups directly using the subquery logic
        const acts = lrResult.rows.map((r: any) => r.global_act_id);
        const reqMap = new Map<string, { labRequestIds: string[] }>();
        const reqGroupRows = await client.query(`
            SELECT lr.id as req_id, lasc.id as lasc_id, lasc.id as lsct_id
            FROM public.lab_requests lr
            JOIN lab_act_specimen_containers lasc ON lasc.global_act_id = lr.global_act_id AND lasc.actif = true
            WHERE lr.prescription_event_id = ANY($1)
        `, [prescriptionEventIds]);

        for (const row of reqGroupRows.rows) {
            if (!reqMap.has(row.lsct_id)) reqMap.set(row.lsct_id, { labRequestIds: [] });
            reqMap.get(row.lsct_id)!.labRequestIds.push(row.req_id);
        }

        // Execute Tube mapping
        for (const [targetLsctId, reqData] of Array.from(reqMap.entries())) {
            const specimenId = uuidv4();
            const barcode = generateSpecimenBarcode();
            
            // 2. Create Specimen
            await client.query(`
                INSERT INTO lab_specimens (
                    id, lab_act_specimen_container_id, barcode, created_at, created_by_user_id
                ) VALUES ($1, $2, $3, NOW(), $4)
            `, [specimenId, targetLsctId, barcode, userId]);

            // 3. Link Requests
            for (const lrId of [...new Set(reqData.labRequestIds)]) {
                const lsrId = uuidv4();
                await client.query(`
                    INSERT INTO lab_specimen_requests (id, lab_request_id, specimen_id)
                    VALUES ($1, $2, $3)
                `, [lsrId, lrId, specimenId]);
            }

            // 4. Link Specimen to Collection
            await client.query(`
                INSERT INTO lab_collection_specimens (lab_collection_id, specimen_id)
                VALUES ($1, $2)
            `, [labCollectionId, specimenId]);
        }

        // 5. Link Administration Events exactly to Collection
        // EMR Controller has ALREADY created the administration_events and given us their IDs.
        for (const mapped of payload.mappedEvents) {
            await client.query(`
                INSERT INTO administration_event_lab_collections (
                    administration_event_id, lab_collection_id
                ) VALUES ($1, $2)
            `, [mapped.administration_event_id, labCollectionId]);
        }

        // Return standard response
        return { success: true, labCollectionId };
    },

    async executeSurveillanceCollection(tenantId: string, userId: string, payload: {
        anchor_prescription_event_id: string;
        selected_prescription_event_ids: string[];
        collected_at: string;
        note: string;
    }) {
        if (!payload.selected_prescription_event_ids || payload.selected_prescription_event_ids.length === 0) {
            throw new Error("No events selected");
        }

        const result = await tenantTransaction(tenantId, async (client) => {
            const labCollectionId = uuidv4();
            
            // Track required data
            const lrResult = await client.query(`
                SELECT lr.id, lr.prescription_event_id, lr.global_act_id, lr.admission_id, lr.tenant_patient_id
                FROM public.lab_requests lr
                WHERE lr.prescription_event_id = ANY($1)
            `, [payload.selected_prescription_event_ids]);
            
            if (lrResult.rows.length === 0) throw new Error("No linked lab requests found");
            const admissionId = lrResult.rows[0].admission_id;
            const patientId = lrResult.rows[0].tenant_patient_id;

            // 1. Create Core Lab Collection
            await client.query(`
                INSERT INTO public.lab_collections (
                    id, tenant_patient_id, admission_id,
                    collected_by_user_id, collected_at
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                labCollectionId, patientId, admissionId,
                userId, payload.collected_at ? new Date(payload.collected_at) : new Date()
            ]);

            // Compute groups directly using the subquery logic
            const acts = lrResult.rows.map(r => r.global_act_id);
            const reqMap = new Map<string, { labRequestIds: string[] }>();
            const reqGroupRows = await client.query(`
                SELECT lr.id as req_id, lasc.id as lasc_id, lasc.id as lsct_id
                FROM public.lab_requests lr
                JOIN lab_act_specimen_containers lasc ON lasc.global_act_id = lr.global_act_id AND lasc.actif = true
                WHERE lr.prescription_event_id = ANY($1)
            `, [payload.selected_prescription_event_ids]);

            for (const row of reqGroupRows.rows) {
                if (!reqMap.has(row.lsct_id)) reqMap.set(row.lsct_id, { labRequestIds: [] });
                reqMap.get(row.lsct_id)!.labRequestIds.push(row.req_id);
            }

            // Execute Tube mapping
            const createdSpecimens: { specimenId: string; barcode: string; lsctId: string }[] = [];
            for (const [targetLsctId, reqData] of Array.from(reqMap.entries())) {
                const specimenId = uuidv4();
                const barcode = generateSpecimenBarcode();
                createdSpecimens.push({ specimenId, barcode, lsctId: targetLsctId });
                
                // 2. Create Specimen
                await client.query(`
                    INSERT INTO lab_specimens (
                        id, lab_act_specimen_container_id, barcode, created_at, created_by_user_id
                    ) VALUES ($1, $2, $3, NOW(), $4)
                `, [specimenId, targetLsctId, barcode, userId]);

                // 3. Link Requests
                for (const lrId of [...new Set(reqData.labRequestIds)]) {
                    const lsrId = uuidv4();
                    await client.query(`
                        INSERT INTO lab_specimen_requests (id, lab_request_id, specimen_id)
                        VALUES ($1, $2, $3)
                    `, [lsrId, lrId, specimenId]);
                }

                // 4. Link Specimen to Collection
                await client.query(`
                    INSERT INTO lab_collection_specimens (lab_collection_id, specimen_id)
                    VALUES ($1, $2)
                `, [labCollectionId, specimenId]);
            }

            // 5. Administration Event linking is handled externally by logWithBiology.
            // executeSurveillanceCollection only creates physical specimens and billing.

            // 6. Billing
            for (const row of lrResult.rows) {
                await client.query(`
                    INSERT INTO admission_acts (
                        id, admission_id, global_act_id, lab_request_id,
                        quantity, created_at
                    )
                    SELECT $1, $2, $3, $4, 1, NOW()
                    WHERE NOT EXISTS (
                        SELECT 1 FROM admission_acts
                        WHERE admission_id = $2
                        AND global_act_id = $3
                        AND lab_request_id = $4
                    )
                `, [uuidv4(), row.admission_id, row.global_act_id, row.id]);
            }

            return { success: true, labCollectionId, specimens: createdSpecimens };
        });

        // HPRIM: Fire ORM generation for each created specimen (non-blocking)
        if (result?.specimens) {
            const specIds = result.specimens.map((s: any) => s.specimenId);
            hprimOutboundService.generateOrmForSpecimens(tenantId, specIds)
                .catch(err => console.error('[HPRIM] ORM trigger failed (surveillance):', err.message));
        }

        return result;
    },

    async executePrelevement(tenantId: string, userId: string, params: {
        patientId: string,
        admissionId: string,
        targetLsctId: string,
        labRequestIds: string[]
    }) {
        const result = await tenantTransaction(tenantId, async (client) => {
            // STEP 1: Ensure collection event exists for this admission
            let collectionResult = await client.query(`
                SELECT id FROM public.lab_collections 
                WHERE admission_id = $1
                ORDER BY collected_at DESC LIMIT 1
            `, [params.admissionId]);

            let collectionId = collectionResult.rows[0]?.id;
            if (!collectionId) {
                const newCol = await client.query(`
                    INSERT INTO public.lab_collections (tenant_patient_id, admission_id, collected_by_user_id, collected_at)
                    VALUES ($1, $2, $3, NOW())
                    RETURNING id
                `, [params.patientId, params.admissionId, userId]);
                collectionId = newCol.rows[0].id;
            }

            // STEP 2: Create Specimen physical entity
            const barcode = generateSpecimenBarcode();
            const newSpec = await client.query(`
                INSERT INTO public.lab_specimens (lab_act_specimen_container_id, barcode, created_by_user_id)
                VALUES ($1, $2, $3)
                RETURNING id
            `, [params.targetLsctId, barcode, userId]);
            const specimenId = newSpec.rows[0].id;

            // Bridge collection and specimen
            await client.query(`
                INSERT INTO public.lab_collection_specimens (lab_collection_id, specimen_id)
                VALUES ($1, $2)
            `, [collectionId, specimenId]);

            // STEP 3: Link Specimen to requests
            for (const lrId of params.labRequestIds) {
                // Prevent duplicate linking
                const dupCheck = await client.query(`
                    SELECT id FROM public.lab_specimen_requests 
                    WHERE specimen_id = $1 AND lab_request_id = $2
                `, [specimenId, lrId]);
                
                if (dupCheck.rows.length === 0) {
                    await client.query(`
                        INSERT INTO public.lab_specimen_requests (specimen_id, lab_request_id)
                        VALUES ($1, $2)
                    `, [specimenId, lrId]);
                }
            }

            return { specimenId, collectionId, barcode };
        });

        // HPRIM: Fire ORM generation after collection (non-blocking)
        if (result?.specimenId) {
            hprimOutboundService.generateOrmForSpecimen(tenantId, result.specimenId)
                .catch(err => console.error('[HPRIM] ORM trigger failed (executePrelevement):', err.message));
        }

        return result;
    },

    /**
     * Update specimen status (nurse-side).
     * Only allows COLLECTED → REJECTED or COLLECTED → INSUFFICIENT.
     * RECEIVED specimens cannot be changed by nurses.
     */
    async updateSpecimenStatus(
        tenantId: string,
        specimenId: string,
        status: string,
        rejectedReason?: string,
        userId?: string
    ): Promise<{ id: string; status: string; rejected_reason: string | null }> {
        // Validate target status
        const allowedStatuses = ['REJECTED', 'INSUFFICIENT'];
        if (!allowedStatuses.includes(status)) {
            throw new Error(`Invalid status '${status}'. Allowed: ${allowedStatuses.join(', ')}`);
        }

        return tenantTransaction(tenantId, async (client) => {
            // Fetch current specimen status
            const current = await client.query(
                `SELECT id, status FROM public.lab_specimens WHERE id = $1`,
                [specimenId]
            );
            if (current.rows.length === 0) {
                throw new Error(`Specimen ${specimenId} not found.`);
            }
            const oldStatus = current.rows[0].status;
            if (oldStatus === 'RECEIVED') {
                throw new Error(`Cannot change a specimen that has already been received by the lab.`);
            }

            const now = new Date();

            // Build update query
            if (status === 'REJECTED') {
                await client.query(`
                    UPDATE public.lab_specimens 
                    SET status = $1, rejected_reason = $2,
                        rejected_at = $3, rejected_by_user_id = $4,
                        last_status_changed_at = $3, last_status_changed_by_user_id = $4
                    WHERE id = $5`,
                    [status, rejectedReason || null, now, userId || null, specimenId]
                );
            } else {
                await client.query(`
                    UPDATE public.lab_specimens 
                    SET status = $1, 
                        last_status_changed_at = $2, last_status_changed_by_user_id = $3
                    WHERE id = $4`,
                    [status, now, userId || null, specimenId]
                );
            }

            // Insert history row
            await client.query(`
                INSERT INTO public.lab_specimen_status_history
                    (specimen_id, old_status, new_status, changed_at, changed_by_user_id, reason)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [specimenId, oldStatus, status, now, userId || null, status === 'REJECTED' ? (rejectedReason || null) : null]
            );

            return { id: specimenId, status, rejected_reason: status === 'REJECTED' ? (rejectedReason || null) : null };
        }, { userId: userId || 'system' });
    }
};
