/**
 * HPRIM Inbound Service
 * 
 * Processes inbound HPRIM ORU files:
 * 1. Parses the HPRIM message
 * 2. Resolves OBR → lab_request via lab_hprim_links
 * 3. Resolves OBX analyte/unit via mapping tables
 * 4. Creates patient_lab_report + tests + results
 * 5. Tracks processing state in lab_hprim_messages
 */

import { tenantQuery, tenantTransaction } from '../../../db/tenantPg';
import { parseHprimMessage } from './hprimParser';
import { hprimMappingService } from './hprimMappingService';
import { archiveFiles, moveToError } from './hprimFileService';
import { hprimConfig } from './hprimConfig';
import { HprimObr, HprimObx } from './hprimTypes';
import { v4 as uuidv4 } from 'uuid';

/**
 * Map HPRIM value type (NM, ST, CE, TX) to our internal types
 */
function mapValueType(hprimType: string): 'NUMERIC' | 'TEXT' | 'BOOLEAN' | 'CHOICE' {
    switch (hprimType.toUpperCase()) {
        case 'NM': return 'NUMERIC';
        case 'CE': return 'CHOICE';
        case 'ST':
        case 'TX':
        default: return 'TEXT';
    }
}

/**
 * Parse HPRIM reference range string (e.g., "4.0-10.0")
 */
function parseReferenceRange(rangeStr: string): { low: number | null; high: number | null; text: string } {
    const result = { low: null as number | null, high: null as number | null, text: rangeStr };
    if (!rangeStr) return result;

    // Try format "low-high" or "low - high"
    const match = rangeStr.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
    if (match) {
        result.low = parseFloat(match[1]);
        result.high = parseFloat(match[2]);
        if (isNaN(result.low)) result.low = null;
        if (isNaN(result.high)) result.high = null;
    }
    return result;
}

/**
 * Map HPRIM abnormal flag to our internal representation
 */
function mapAbnormalFlag(flag: string): string | null {
    if (!flag) return null;
    switch (flag.toUpperCase()) {
        case 'H':
        case 'HH': return 'HIGH';
        case 'L':
        case 'LL': return 'LOW';
        case 'N': return 'NORMAL';
        case 'A': return 'ABNORMAL';
        default: return flag;
    }
}

export const hprimInboundService = {

    /**
     * Process a single inbound ORU file.
     * 
     * @param tenantId - Tenant database to write results into
     * @param fileName - The .hpr filename
     * @param rawContent - File content
     * @param hprPath - Full path to .hpr file
     * @param okPath - Full path to .ok file
     */
    async processOruFile(
        tenantId: string,
        fileName: string,
        rawContent: string,
        hprPath: string,
        okPath: string
    ): Promise<void> {

        // 1. Check idempotency — skip if already processed
        const existing = await tenantQuery<any>(tenantId, `
            SELECT id, status FROM public.lab_hprim_messages 
            WHERE file_name = $1 AND direction = 'INBOUND'
        `, [fileName]);

        if (existing.length > 0 && existing[0].status === 'PROCESSED') {
            console.log(`[HPRIM Inbound] File ${fileName} already processed — skipping`);
            archiveFiles(hprPath, okPath, hprimConfig.archivePath);
            return;
        }

        // 2. Insert or update tracking record
        let messageId: string;
        if (existing.length > 0) {
            messageId = existing[0].id;
            await tenantQuery(tenantId, `
                UPDATE public.lab_hprim_messages 
                SET status = 'PENDING', error_message = NULL, retry_count = retry_count + 1
                WHERE id = $1
            `, [messageId]);
        } else {
            const msgRows = await tenantQuery<any>(tenantId, `
                INSERT INTO public.lab_hprim_messages 
                    (direction, message_type, file_name, file_path, ok_file_name, status, payload_text, max_retries)
                VALUES ('INBOUND', 'ORU', $1, $2, $3, 'PENDING', $4, $5)
                RETURNING id
            `, [fileName, hprPath, fileName.replace(/\.hpr$/i, '.ok'), rawContent, hprimConfig.maxRetries]);
            messageId = msgRows[0].id;
        }

        try {
            // 3. Parse HPRIM message
            const parsed = parseHprimMessage(rawContent);

            if (parsed.orders.length === 0) {
                throw new Error('ORU contains no OBR segments');
            }

            // 4. Process within transaction
            await tenantTransaction(tenantId, async (client) => {
                
                // For each OBR, resolve the original request and create report/test/results
                for (const obr of parsed.orders) {
                    await this.processObr(client, tenantId, messageId, parsed.patient.patientId, obr);
                }
            });

            // 5. Mark PROCESSED
            await tenantQuery(tenantId, `
                UPDATE public.lab_hprim_messages 
                SET status = 'PROCESSED', processed_at = NOW()
                WHERE id = $1
            `, [messageId]);

            // 6. Archive files
            archiveFiles(hprPath, okPath, hprimConfig.archivePath);

            console.log(`[HPRIM Inbound] ✅ Processed ${fileName}: ${parsed.orders.length} OBR(s)`);

        } catch (err: any) {
            console.error(`[HPRIM Inbound] ❌ Failed to process ${fileName}:`, err.message);

            await tenantQuery(tenantId, `
                UPDATE public.lab_hprim_messages 
                SET status = 'ERROR', error_message = $1
                WHERE id = $2
            `, [err.message.substring(0, 2000), messageId]);

            moveToError(hprPath, okPath, hprimConfig.errorPath);
        }
    },

    /**
     * Process a single OBR and its OBX results
     */
    async processObr(
        client: any,
        tenantId: string,
        messageId: string,
        patientIpp: string,
        obr: HprimObr
    ): Promise<void> {

        // Resolve internal lab_request via HPRIM link
        const link = await hprimMappingService.resolveHprimLinkByOrderId(tenantId, obr.placerOrderId);

        let labRequestId: string | null = null;
        let tenantPatientId: string | null = null;
        let admissionId: string | null = null;
        let globalActId: string | null = null;

        if (link) {
            labRequestId = link.lab_request_id;

            // Load request details
            const reqRows = await client.query(`
                SELECT tenant_patient_id, admission_id, global_act_id
                FROM public.lab_requests WHERE id = $1
            `, [labRequestId]);

            if (reqRows.rows.length > 0) {
                tenantPatientId = reqRows.rows[0].tenant_patient_id;
                admissionId = reqRows.rows[0].admission_id;
                globalActId = reqRows.rows[0].global_act_id;
            }

            // Mark link as consumed
            await hprimMappingService.markLinkConsumed(tenantId, obr.placerOrderId);
        }

        // If we couldn't resolve via link, try to find patient by IPP
        if (!tenantPatientId && patientIpp) {
            const ippRows = await client.query(`
                SELECT tenant_patient_id FROM public.identity_ids
                WHERE identity_value = $1 AND identity_type_code = 'LOCAL_MRN' AND is_primary = true
                LIMIT 1
            `, [patientIpp]);
            if (ippRows.rows.length > 0) {
                tenantPatientId = ippRows.rows[0].tenant_patient_id;
            }
        }

        if (!tenantPatientId) {
            throw new Error(`Cannot resolve patient for OBR order_id=${obr.placerOrderId}, IPP=${patientIpp}`);
        }

        // Create patient_lab_report
        const reportId = uuidv4();
        const collectedAt = obr.collectionDateTime
            ? new Date(obr.collectionDateTime.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'))
            : null;

        await client.query(`
            INSERT INTO public.patient_lab_reports (
                id, tenant_patient_id, admission_id,
                source_type, status, structuring_status,
                report_title, source_lab_name, source_lab_report_number,
                collected_at, received_at,
                used_ai_assistance, uploaded_by_user_id, uploaded_at
            ) VALUES (
                $1, $2, $3,
                'EXTERNAL_INTERFACE', 'DRAFT', 'STRUCTURED',
                $4, 'EVM', $5,
                $6, NOW(),
                false, '00000000-0000-0000-0000-000000000000', NOW()
            )
        `, [
            reportId, tenantPatientId, admissionId,
            `Résultats EVM - ${obr.universalServiceText || obr.universalServiceId}`,
            obr.placerOrderId,
            collectedAt,
        ]);

        // Create patient_lab_report_test
        const testId = uuidv4();
        await client.query(`
            INSERT INTO public.patient_lab_report_tests (
                id, patient_lab_report_id, global_act_id,
                raw_test_label, display_order
            ) VALUES ($1, $2, $3, $4, 1)
        `, [testId, reportId, globalActId, obr.universalServiceText || obr.universalServiceId]);

        // Process each OBX
        for (let i = 0; i < obr.observations.length; i++) {
            const obx = obr.observations[i];
            await this.processObx(client, tenantId, reportId, testId, obx, i);
        }
    },

    /**
     * Process a single OBX result line
     */
    async processObx(
        client: any,
        tenantId: string,
        reportId: string,
        testId: string,
        obx: HprimObx,
        index: number
    ): Promise<void> {

        // Resolve analyte
        const analyteMapping = await hprimMappingService.resolveAnalyteByExternalCode(
            tenantId, obx.observationId
        );

        // Resolve unit
        const unitMapping = await hprimMappingService.resolveUnitByExternalCode(
            tenantId, obx.units
        );

        // Parse values
        const valueType = mapValueType(obx.valueType);
        let numericValue: number | null = null;
        let textValue: string | null = null;

        if (valueType === 'NUMERIC') {
            // Handle comma as decimal separator (French convention)
            const cleaned = obx.observationValue.replace(',', '.');
            numericValue = parseFloat(cleaned);
            if (isNaN(numericValue)) {
                numericValue = null;
                textValue = obx.observationValue;
            }
        } else {
            textValue = obx.observationValue;
        }

        // Parse reference range
        const refRange = parseReferenceRange(obx.referenceRange);

        // Map abnormal flag
        const abnormalFlag = mapAbnormalFlag(obx.abnormalFlag);

        // Build source line reference for traceability
        const sourceRef = `OBX-${index + 1}:${obx.observationId}`;

        await client.query(`
            INSERT INTO public.patient_lab_results (
                id, patient_lab_report_id, patient_lab_report_test_id,
                analyte_id, lab_analyte_context_id, raw_analyte_label,
                value_type, numeric_value, text_value,
                unit_id, raw_unit_text,
                reference_range_text, reference_low_numeric, reference_high_numeric,
                raw_abnormal_flag_text, abnormal_flag,
                source_line_reference, status
            ) VALUES (
                $1, $2, $3,
                $4, $5, $6,
                $7, $8, $9,
                $10, $11,
                $12, $13, $14,
                $15, $16,
                $17, 'ACTIVE'
            )
        `, [
            uuidv4(), reportId, testId,
            analyteMapping?.analyte_id || null,
            analyteMapping?.lab_analyte_context_id || null,
            obx.observationText || obx.observationId,
            valueType, numericValue, textValue,
            unitMapping?.unit_id || null, obx.units || null,
            refRange.text || null, refRange.low, refRange.high,
            obx.abnormalFlag || null, abnormalFlag,
            sourceRef,
        ]);
    },
};
