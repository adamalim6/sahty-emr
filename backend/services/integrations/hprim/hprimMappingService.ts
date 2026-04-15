/**
 * HPRIM Mapping Service
 * 
 * Resolves mappings between internal and external (EVM) codes:
 * - Act codes (global_act_external_codes)
 * - Analyte codes (lab_analyte_external_codes)
 * - Unit codes (lab_unit_external_codes)
 * - HPRIM link management (lab_hprim_links)
 */

import { tenantQuery } from '../../../db/tenantPg';

const EVM_SYSTEM_CODE = 'EVM';

export const hprimMappingService = {

    // ── Act Code Resolution (Outbound) ──────────────────────────────

    /**
     * Get the EVM external code for a global act.
     * Returns null if no mapping exists.
     */
    async resolveActExternalCode(
        tenantId: string,
        globalActId: string
    ): Promise<{ external_code: string; system_id: string } | null> {
        const rows = await tenantQuery<any>(tenantId, `
            SELECT gaec.external_code, gaec.external_system_id as system_id
            FROM public.global_act_external_codes gaec
            JOIN public.external_systems es ON es.id = gaec.external_system_id
            WHERE gaec.global_act_id = $1
              AND es.code = $2
              AND gaec.is_active = TRUE
              AND es.is_active = TRUE
            LIMIT 1
        `, [globalActId, EVM_SYSTEM_CODE]);
        return rows[0] || null;
    },

    /**
     * Batch resolve external codes for multiple act IDs.
     * Returns a map: globalActId → external_code
     */
    async resolveActExternalCodes(
        tenantId: string,
        globalActIds: string[]
    ): Promise<Map<string, string>> {
        if (globalActIds.length === 0) return new Map();

        const rows = await tenantQuery<any>(tenantId, `
            SELECT gaec.global_act_id, gaec.external_code
            FROM public.global_act_external_codes gaec
            JOIN public.external_systems es ON es.id = gaec.external_system_id
            WHERE gaec.global_act_id = ANY($1)
              AND es.code = $2
              AND gaec.is_active = TRUE
              AND es.is_active = TRUE
        `, [globalActIds, EVM_SYSTEM_CODE]);

        const map = new Map<string, string>();
        for (const row of rows) {
            map.set(row.global_act_id, row.external_code);
        }
        return map;
    },

    // ── Analyte Code Resolution (Inbound) ───────────────────────────

    /**
     * Resolve an external analyte code from EVM to an internal analyte.
     * Returns analyte_id and best lab_analyte_context_id if available.
     */
    async resolveAnalyteByExternalCode(
        tenantId: string,
        externalCode: string
    ): Promise<{ analyte_id: string; lab_analyte_context_id: string | null } | null> {
        // First try public.lab_analyte_external_codes
        const rows = await tenantQuery<any>(tenantId, `
            SELECT laec.analyte_id,
                   (SELECT lac.id FROM lab_analyte_contexts lac 
                    WHERE lac.analyte_id = laec.analyte_id AND lac.is_default = true AND lac.actif = true 
                    LIMIT 1) as lab_analyte_context_id
            FROM public.lab_analyte_external_codes laec
            JOIN public.external_systems es ON es.id = laec.external_system_id
            WHERE laec.external_code = $1
              AND es.code = $2
              AND laec.is_active = TRUE
            LIMIT 1
        `, [externalCode, EVM_SYSTEM_CODE]);

        if (rows[0]) return rows[0];

        // Fallback: try matching directly on reference.lab_analytes.code
        const fallback = await tenantQuery<any>(tenantId, `
            SELECT la.id as analyte_id,
                   (SELECT lac.id FROM lab_analyte_contexts lac 
                    WHERE lac.analyte_id = la.id AND lac.is_default = true AND lac.actif = true 
                    LIMIT 1) as lab_analyte_context_id
            FROM reference.lab_analytes la
            WHERE la.code = $1 AND la.actif = true
            LIMIT 1
        `, [externalCode]);

        return fallback[0] || null;
    },

    // ── Unit Code Resolution (Inbound) ──────────────────────────────

    /**
     * Resolve an external unit code from EVM to an internal unit.
     * Falls back to matching reference.units.code or reference.units.display.
     */
    async resolveUnitByExternalCode(
        tenantId: string,
        externalCode: string
    ): Promise<{ unit_id: string } | null> {
        if (!externalCode || externalCode.trim() === '') return null;

        // Try explicit mapping first
        const mapped = await tenantQuery<any>(tenantId, `
            SELECT luec.unit_id
            FROM public.lab_unit_external_codes luec
            JOIN public.external_systems es ON es.id = luec.external_system_id
            WHERE luec.external_code = $1
              AND es.code = $2
              AND luec.is_active = TRUE
            LIMIT 1
        `, [externalCode, EVM_SYSTEM_CODE]);

        if (mapped[0]) return mapped[0];

        // Fallback: direct match on reference.units.code or display
        const fallback = await tenantQuery<any>(tenantId, `
            SELECT id as unit_id
            FROM reference.units
            WHERE (code = $1 OR display = $1) AND is_active = true
            LIMIT 1
        `, [externalCode]);

        return fallback[0] || null;
    },

    // ── HPRIM Link Management ───────────────────────────────────────

    /**
     * Create a new HPRIM link (outbound: internal → HPRIM identifiers)
     */
    async createHprimLink(
        tenantId: string,
        data: {
            hprim_message_id: string;
            lab_request_id: string;
            lab_specimen_id: string | null;
            hprim_order_id: string;
            hprim_sample_id: string | null;
        }
    ): Promise<void> {
        await tenantQuery(tenantId, `
            INSERT INTO public.lab_hprim_links 
                (hprim_message_id, lab_request_id, lab_specimen_id, hprim_order_id, hprim_sample_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (hprim_order_id) DO NOTHING
        `, [
            data.hprim_message_id,
            data.lab_request_id,
            data.lab_specimen_id,
            data.hprim_order_id,
            data.hprim_sample_id,
        ]);
    },

    /**
     * Resolve a HPRIM order ID back to internal lab_request_id (inbound ORU)
     */
    async resolveHprimLinkByOrderId(
        tenantId: string,
        hprimOrderId: string
    ): Promise<{
        lab_request_id: string;
        lab_specimen_id: string | null;
        hprim_message_id: string;
    } | null> {
        const rows = await tenantQuery<any>(tenantId, `
            SELECT lab_request_id, lab_specimen_id, hprim_message_id
            FROM public.lab_hprim_links
            WHERE hprim_order_id = $1
            LIMIT 1
        `, [hprimOrderId]);
        return rows[0] || null;
    },

    /**
     * Mark a HPRIM link as consumed (ORU received and processed)
     */
    async markLinkConsumed(tenantId: string, hprimOrderId: string): Promise<void> {
        await tenantQuery(tenantId, `
            UPDATE public.lab_hprim_links
            SET consumed_at = NOW()
            WHERE hprim_order_id = $1
        `, [hprimOrderId]);
    },

    // ── EVM System ID Lookup ────────────────────────────────────────

    /**
     * Get the EVM external_system row
     */
    async getEvmSystemId(tenantId: string): Promise<string | null> {
        const rows = await tenantQuery<any>(tenantId, `
            SELECT id FROM public.external_systems
            WHERE code = $1 AND is_active = TRUE
            LIMIT 1
        `, [EVM_SYSTEM_CODE]);
        return rows[0]?.id || null;
    },
};
