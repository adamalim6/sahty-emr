import { tenantQuery, tenantTransaction } from '../../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';

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
                const prescId = uuidv4();
                await client.query(`
                    INSERT INTO prescriptions (
                        id, tenant_id, tenant_patient_id, admission_id,
                        prescription_type, status, created_by,
                        global_act_id
                    ) VALUES ($1, $2, $3, $4, 'biology', 'ACTIVE', $5, $6)
                `, [prescId, tenantId, payload.tenantPatientId, payload.admissionId, userId, actId]);

                const eventId = uuidv4();
                await client.query(`
                    INSERT INTO prescription_events (
                        id, tenant_id, prescription_id, admission_id,
                        scheduled_at, status, tenant_patient_id
                    ) VALUES ($1, $2, $3, $4, NOW(), 'ACTIVE', $5)
                `, [eventId, tenantId, prescId, payload.admissionId, payload.tenantPatientId]);

                const labRequestId = uuidv4();
                
                // 1. Insert Lab Request
                await client.query(`
                    INSERT INTO lab_requests (
                        id, tenant_patient_id, admission_id,
                        global_act_id, prescription_event_id,
                        created_by_user_id, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, NOW()
                    )
                `, [labRequestId, payload.tenantPatientId, payload.admissionId, actId, eventId, userId]);

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
    async _buildCollectionRequirementsGroups(tenantId: string, joinConditionSQL: string, values: any[]) {
        const rows = await tenantQuery(tenantId, `
            SELECT 
               lr.id as lab_request_id,
               pe.id as prescription_event_id,
               ga.libelle_sih as lab_request_name,
               lasc.specimen_type_id,
               lst.libelle as specimen_label,
               lasc.container_type_id,
               lct.libelle as container_label,
               lct.tube_color as container_color,
               lsct.id as target_lsct_id,
               lsr.id as existing_link_id
            FROM public.lab_requests lr
            JOIN public.prescription_events pe ON pe.id = lr.prescription_event_id
            JOIN reference.global_actes ga ON ga.id = lr.global_act_id
            JOIN reference.lab_act_specimen_containers lasc 
                 ON lasc.global_act_id = lr.global_act_id AND lasc.actif = true
            JOIN reference.lab_specimen_types lst ON lst.id = lasc.specimen_type_id
            JOIN reference.lab_container_types lct ON lct.id = lasc.container_type_id
            JOIN reference.lab_specimen_container_types lsct 
                 ON lsct.specimen_type_id = lasc.specimen_type_id 
                 AND lsct.container_type_id = lasc.container_type_id
            LEFT JOIN public.lab_specimen_requests lsr 
                 ON lsr.lab_request_id = lr.id 
                 AND EXISTS (
                    SELECT 1 FROM public.lab_specimens s 
                    WHERE s.id = lsr.specimen_id 
                    AND s.lab_specimen_container_type_id = lsct.id
                 )
            ${joinConditionSQL}
            ORDER BY lasc.sort_order ASC
        `, values);

        // Aggregate by [specimen_type_id + container_type_id]
        const map = new Map<string, any>();
        rows.forEach((r: any) => {
            const key = `${r.specimen_type_id}_${r.container_type_id}`;
            if (!map.has(key)) {
                map.set(key, {
                    specimen_type_id: r.specimen_type_id,
                    container_type_id: r.container_type_id,
                    target_lsct_id: r.target_lsct_id,
                    specimen_label: r.specimen_label,
                    container_label: r.container_label,
                    container_color: r.container_color,
                    lab_requests: [],
                    is_collected: true, // Will flip to false if we find an uncollected one
                });
            }

            const group = map.get(key);
            group.lab_requests.push({
                id: r.lab_request_id,
                prescription_event_id: r.prescription_event_id,
                name: r.lab_request_name,
                is_collected: !!r.existing_link_id
            });
            if (!r.existing_link_id) group.is_collected = false;
        });

        return Array.from(map.values());
    },

    /**
     * Resolves the required physical specimens and their linked acts for a walk-in admission.
     */
    async getCollectionRequirements(tenantId: string, admissionId: string) {
        return this._buildCollectionRequirementsGroups(
            tenantId, 
            "WHERE lr.admission_id = $1 AND pe.status = 'ACTIVE'", 
            [admissionId]
        );
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
            AND NOT EXISTS (
                SELECT 1 FROM administration_event_lab_collections aelc
                JOIN administration_events ae ON ae.id = aelc.administration_event_id
                WHERE ae.prescription_event_id = pe.id
            )
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

        return {
            anchor_event: { id: prescriptionEventId },
            candidate_events: candidateEvents,
            suggested_specimens: groups
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
            SELECT lr.id as req_id, lasc.id as lasc_id, lsct.id as lsct_id
            FROM public.lab_requests lr
            JOIN reference.lab_act_specimen_containers lasc ON lasc.global_act_id = lr.global_act_id AND lasc.actif = true
            JOIN reference.lab_specimen_container_types lsct 
                 ON lsct.specimen_type_id = lasc.specimen_type_id 
                 AND lsct.container_type_id = lasc.container_type_id
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
                    id, lab_specimen_container_type_id, barcode, created_at, created_by_user_id
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

        return await tenantTransaction(tenantId, async (client) => {
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
                SELECT lr.id as req_id, lasc.id as lasc_id, lsct.id as lsct_id
                FROM public.lab_requests lr
                JOIN reference.lab_act_specimen_containers lasc ON lasc.global_act_id = lr.global_act_id AND lasc.actif = true
                JOIN reference.lab_specimen_container_types lsct 
                     ON lsct.specimen_type_id = lasc.specimen_type_id 
                     AND lsct.container_type_id = lasc.container_type_id
                WHERE lr.prescription_event_id = ANY($1)
            `, [payload.selected_prescription_event_ids]);

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
                        id, lab_specimen_container_type_id, barcode, created_at, created_by_user_id
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

            // 5. Administration Events
            for (const peId of payload.selected_prescription_event_ids) {
                const adminEventId = uuidv4();
                await client.query(`
                    INSERT INTO administration_events (
                        id, tenant_id, prescription_event_id, action_type, 
                        occurred_at, performed_by_user_id, status
                    ) VALUES ($1, $2, $3, 'completed', $4, $5, 'ACTIVE')
                `, [
                    adminEventId, tenantId, peId, 
                    payload.collected_at ? new Date(payload.collected_at) : new Date(),
                    userId
                ]);

                await client.query(`
                    INSERT INTO administration_event_lab_collections (
                        administration_event_id, lab_collection_id
                    ) VALUES ($1, $2)
                `, [adminEventId, labCollectionId]);
            }

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

            return { success: true, labCollectionId };
        });
    },

    async executePrelevement(tenantId: string, userId: string, params: {
        patientId: string,
        admissionId: string,
        targetLsctId: string,
        labRequestIds: string[]
    }) {
        return await tenantTransaction(tenantId, async (client) => {
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
                INSERT INTO public.lab_specimens (lab_specimen_container_type_id, barcode, created_by_user_id)
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
    }
};
