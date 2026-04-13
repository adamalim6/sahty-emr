/**
 * HPRIM Outbound Service
 * 
 * Generates HPRIM ORM messages for specimens and writes them to the aller/ folder.
 * 
 * Trigger points:
 * - Walk-in: after executePrelevement() — specimens + barcodes exist
 * - Hospitalized: after receiveSpecimen() — specimen transitions to RECEIVED
 * 
 * One ORM per specimen. Multiple OBR segments inside (one per linked act).
 * Only generates when at least one act has an EVM mapping.
 */

import { nanoid } from 'nanoid';
import { tenantQuery } from '../../../db/tenantPg';
import { hprimConfig } from './hprimConfig';
import { hprimMappingService } from './hprimMappingService';
import { serializeOrm } from './hprimSerializer';
import { writeHprFile, writeOkFile } from './hprimFileService';
import { HprimPatient, HprimObr } from './hprimTypes';

/**
 * Generate an HPRIM order ID (deterministic, unique)
 */
function generateHprimOrderId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = nanoid(4).toUpperCase();
    return `SHTY-${ts}-${rand}`;
}

/**
 * Generate a filename for an ORM file
 */
function generateOrmFilename(specimenBarcode: string): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `ORM_${specimenBarcode}_${ts}.hpr`;
}

export const hprimOutboundService = {

    /**
     * Generate ORM for a single specimen.
     * Resolves all linked lab_requests → acts → external codes.
     * 
     * Returns null if no acts have EVM mappings (silent skip).
     */
    async generateOrmForSpecimen(
        tenantId: string,
        specimenId: string
    ): Promise<{ messageId: string; fileName: string } | null> {
        try {
            // 1. Load specimen + linked requests + patient
            const specimenData = await tenantQuery<any>(tenantId, `
                SELECT 
                    ls.id AS specimen_id,
                    ls.barcode,
                    ls.status,
                    lc.collected_at,
                    lc.tenant_patient_id,
                    lc.admission_id
                FROM public.lab_specimens ls
                JOIN public.lab_collection_specimens lcs ON lcs.specimen_id = ls.id
                JOIN public.lab_collections lc ON lc.id = lcs.lab_collection_id
                WHERE ls.id = $1
                LIMIT 1
            `, [specimenId]);

            if (specimenData.length === 0) {
                console.warn(`[HPRIM Outbound] Specimen ${specimenId} not found`);
                return null;
            }

            const specimen = specimenData[0];

            // 2. Load linked lab_requests with act info
            const requests = await tenantQuery<any>(tenantId, `
                SELECT 
                    lr.id AS lab_request_id,
                    lr.global_act_id,
                    ga.code_sih AS act_code,
                    ga.libelle_sih AS act_label
                FROM public.lab_specimen_requests lsr
                JOIN public.lab_requests lr ON lr.id = lsr.lab_request_id
                JOIN reference.global_actes ga ON ga.id = lr.global_act_id
                WHERE lsr.specimen_id = $1
            `, [specimenId]);

            if (requests.length === 0) {
                console.warn(`[HPRIM Outbound] No lab requests linked to specimen ${specimenId}`);
                return null;
            }

            // 3. Resolve EVM external codes for all acts
            const globalActIds = requests.map((r: any) => r.global_act_id);
            const externalCodeMap = await hprimMappingService.resolveActExternalCodes(tenantId, globalActIds);

            // Filter to only acts that have EVM mappings
            const mappedRequests = requests.filter((r: any) => externalCodeMap.has(r.global_act_id));

            if (mappedRequests.length === 0) {
                console.log(`[HPRIM Outbound] No EVM-mapped acts for specimen ${specimenId} — skipping ORM`);
                return null;
            }

            // 4. Load patient info (name, IPP, DOB, sex)
            const patientRows = await tenantQuery<any>(tenantId, `
                SELECT 
                    pt.first_name,
                    pt.last_name,
                    pt.dob,
                    pt.sex,
                    (SELECT ii.identity_value FROM public.identity_ids ii 
                     WHERE ii.tenant_patient_id = pt.tenant_patient_id 
                     AND ii.identity_type_code = 'LOCAL_MRN' AND ii.is_primary = true 
                     LIMIT 1) AS ipp
                FROM public.patients_tenant pt
                WHERE pt.tenant_patient_id = $1
            `, [specimen.tenant_patient_id]);

            const patientRaw = patientRows[0];
            if (!patientRaw) {
                console.error(`[HPRIM Outbound] Patient not found for specimen ${specimenId}`);
                return null;
            }

            // 5. Build HPRIM patient
            const patient: HprimPatient = {
                patientId: patientRaw.ipp || '',
                lastName: patientRaw.last_name || '',
                firstName: patientRaw.first_name || '',
                dateOfBirth: patientRaw.dob 
                    ? new Date(patientRaw.dob).toISOString().slice(0, 10).replace(/-/g, '') 
                    : '',
                sex: patientRaw.sex || 'U',
            };

            // 6. Build OBR segments
            const collectedAt = specimen.collected_at
                ? new Date(specimen.collected_at).toISOString().replace(/[T\-:]/g, '').slice(0, 14)
                : '';

            const messageId = generateHprimOrderId();
            const orders: HprimObr[] = [];
            const linkData: { lab_request_id: string; hprim_order_id: string }[] = [];

            for (let i = 0; i < mappedRequests.length; i++) {
                const req = mappedRequests[i];
                const extCode = externalCodeMap.get(req.global_act_id)!;
                const orderId = `${messageId}-${i + 1}`;

                orders.push({
                    setId: i + 1,
                    placerOrderId: orderId,
                    placerSampleId: specimen.barcode,
                    universalServiceId: extCode,
                    universalServiceText: req.act_label || '',
                    requestedDateTime: new Date().toISOString().replace(/[T\-:]/g, '').slice(0, 14),
                    collectionDateTime: collectedAt,
                    priority: 'R',
                    observations: [],
                });

                linkData.push({ lab_request_id: req.lab_request_id, hprim_order_id: orderId });
            }

            // 7. Serialize ORM
            const payload = serializeOrm(messageId, patient, orders);

            // 8. Write to filesystem
            hprimConfig.ensureDirectories();
            const fileName = generateOrmFilename(specimen.barcode);
            const filePath = writeHprFile(hprimConfig.allerPath, fileName, payload);
            const okFileName = writeOkFile(hprimConfig.allerPath, fileName);

            // 9. Insert lab_hprim_messages
            const msgRows = await tenantQuery<any>(tenantId, `
                INSERT INTO public.lab_hprim_messages 
                    (direction, message_type, file_name, file_path, ok_file_name, status, payload_text, max_retries)
                VALUES ('OUTBOUND', 'ORM', $1, $2, $3, 'WRITTEN', $4, $5)
                RETURNING id
            `, [fileName, filePath, okFileName, payload, hprimConfig.maxRetries]);

            const hprimMessageId = msgRows[0].id;

            // 10. Insert lab_hprim_links
            for (const link of linkData) {
                await hprimMappingService.createHprimLink(tenantId, {
                    hprim_message_id: hprimMessageId,
                    lab_request_id: link.lab_request_id,
                    lab_specimen_id: specimenId,
                    hprim_order_id: link.hprim_order_id,
                    hprim_sample_id: specimen.barcode,
                });
            }

            console.log(`[HPRIM Outbound] ORM generated: ${fileName} (${mappedRequests.length} OBRs) for specimen ${specimen.barcode}`);
            return { messageId: hprimMessageId, fileName };

        } catch (err: any) {
            console.error(`[HPRIM Outbound] Failed to generate ORM for specimen ${specimenId}:`, err.message);
            return null;
        }
    },

    /**
     * Generate ORM for multiple specimens (convenience method).
     * Called after collection where multiple tubes are created.
     */
    async generateOrmForSpecimens(
        tenantId: string,
        specimenIds: string[]
    ): Promise<void> {
        for (const specId of specimenIds) {
            await this.generateOrmForSpecimen(tenantId, specId);
        }
    },
};
