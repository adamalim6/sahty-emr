import { PoolClient } from 'pg';

/**
 * Read-only pricing resolution queries used during charge capture.
 * All queries accept a PoolClient so they participate in the caller's transaction
 * and see a consistent snapshot of coverage + pricing config.
 */
export const pricingResolutionRepository = {

    /**
     * Returns the ACTIVE primary (filing_order = 1) binding for this admission.
     *
     * Under the versioned-binding model (migration 128), each admission carries one
     * ACTIVE primary at any point in time. Membership was pre-verified at bind time
     * and is carried by admission_coverages.coverage_member_id, so no JOIN on
     * coverage_members is needed at pricing-resolution time.
     */
    async getPrimaryCoverage(client: PoolClient, admissionId: string) {
        const res = await client.query(`
            SELECT
                ac.admission_coverage_id,
                ac.organisme_id,
                ac.coverage_id,
                ac.coverage_member_id,
                ac.filing_order
            FROM public.admission_coverages ac
            WHERE ac.admission_id    = $1
              AND ac.binding_status  = 'ACTIVE'
              AND ac.filing_order    = 1
            LIMIT 1
        `, [admissionId]);
        return res.rows[0] || null;
    },

    async findPublishedPricingListForOrganisme(client: PoolClient, organismeId: string) {
        const res = await client.query(`
            SELECT pl.id, pl.code, pl.version_no, pl.currency_code
            FROM public.pricing_list_organismes plo
            JOIN public.pricing_lists pl ON pl.id = plo.pricing_list_id
            WHERE plo.organisme_id = $1
              AND plo.assignment_status = 'ACTIVE'
              AND pl.status = 'PUBLISHED'
              AND pl.is_active = TRUE
              AND (pl.valid_from IS NULL OR pl.valid_from <= CURRENT_DATE)
              AND (pl.valid_to   IS NULL OR pl.valid_to   >= CURRENT_DATE)
              AND (plo.valid_from IS NULL OR plo.valid_from <= CURRENT_DATE)
              AND (plo.valid_to   IS NULL OR plo.valid_to   >= CURRENT_DATE)
            ORDER BY pl.updated_at DESC
            LIMIT 1
        `, [organismeId]);
        return res.rows[0] || null;
    },

    async findDefaultPublishedPricingList(client: PoolClient) {
        const res = await client.query(`
            SELECT id, code, version_no, currency_code
            FROM public.pricing_lists
            WHERE is_default = TRUE
              AND status = 'PUBLISHED'
              AND is_active = TRUE
              AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
              AND (valid_to   IS NULL OR valid_to   >= CURRENT_DATE)
            LIMIT 1
        `);
        return res.rows[0] || null;
    },

    async findActiveItem(client: PoolClient, pricingListId: string, globalActId: string) {
        const res = await client.query(`
            SELECT id
            FROM public.pricing_list_items
            WHERE pricing_list_id = $1
              AND global_act_id   = $2
              AND membership_status = 'ACTIVE'
            LIMIT 1
        `, [pricingListId, globalActId]);
        return res.rows[0] || null;
    },

    async getPublishedItemVersion(client: PoolClient, pricingListItemId: string) {
        const res = await client.query(`
            SELECT id, version_no, unit_price, billing_label
            FROM public.pricing_list_item_versions
            WHERE pricing_list_item_id = $1
              AND status = 'PUBLISHED'
            LIMIT 1
        `, [pricingListItemId]);
        return res.rows[0] || null;
    },

    async listDispatchesForItemVersion(client: PoolClient, itemVersionId: string) {
        const res = await client.query(`
            SELECT dispatch_type, sequence_no, allocation_value
            FROM public.pricing_list_item_version_dispatches
            WHERE pricing_list_item_version_id = $1
            ORDER BY sequence_no ASC
        `, [itemVersionId]);
        return res.rows;
    }
};
