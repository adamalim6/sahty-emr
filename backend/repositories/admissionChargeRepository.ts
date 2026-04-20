import { PoolClient } from 'pg';
import { tenantQuery } from '../db/tenantPg';

/**
 * Low-level SQL for admission charge events / snapshots / dispatches.
 * Write methods accept a PoolClient — the service owns the transaction.
 */
export const admissionChargeRepository = {

    // ---------------------------------------------
    // Writes (TX-bound)
    // ---------------------------------------------

    async createAdmissionAct(
        client: PoolClient,
        data: { admissionId: string; globalActId: string; quantity: number }
    ) {
        const res = await client.query(`
            INSERT INTO public.admission_acts (admission_id, global_act_id, quantity)
            VALUES ($1, $2, $3)
            RETURNING id, admission_id, global_act_id, quantity, created_at
        `, [data.admissionId, data.globalActId, data.quantity]);
        return res.rows[0];
    },

    async createChargeEvent(
        client: PoolClient,
        data: {
            admissionId: string;
            admissionActId: string;
            patientId: string;
            globalActId: string;
            quantity: number;
            status: string;
            pricingStatus: string;
            coverageResolutionMode: string;
            coverageResolutionReason: string | null;
            admissionCoverageId: string | null;
            capturedByUserId: string | null;
        }
    ) {
        const res = await client.query(`
            INSERT INTO public.admission_charge_events (
                admission_id, admission_act_id, patient_id, global_act_id,
                quantity, status, pricing_status,
                coverage_resolution_mode, coverage_resolution_reason,
                admission_coverage_id, captured_by_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            data.admissionId, data.admissionActId, data.patientId, data.globalActId,
            data.quantity, data.status, data.pricingStatus,
            data.coverageResolutionMode, data.coverageResolutionReason,
            data.admissionCoverageId, data.capturedByUserId
        ]);
        return res.rows[0];
    },

    async createSnapshot(
        client: PoolClient,
        data: {
            chargeEventId: string;
            snapshotNo: number;
            isCurrent: boolean;
            supersedesSnapshotId: string | null;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            pricingSourceType: string;
            snapshotSource: string;
            pricingListId: string | null;
            pricingListCode: string | null;
            pricingListVersionNo: number | null;
            pricingListItemId: string | null;
            pricingListItemVersionId: string | null;
            pricingListItemVersionNo: number | null;
            billingLabel: string | null;
            organismeId: string | null;
            admissionCoverageId: string | null;
            coverageResolutionMode: string | null;
            coverageResolutionReason: string | null;
            repricingReason: string | null;
            createdByUserId: string | null;
        }
    ) {
        const res = await client.query(`
            INSERT INTO public.admission_charge_snapshots (
                admission_charge_event_id, snapshot_no, is_current, supersedes_snapshot_id,
                quantity, unit_price_snapshot, total_price_snapshot,
                pricing_source_type, snapshot_source,
                pricing_list_id, pricing_list_code, pricing_list_version_no,
                pricing_list_item_id, pricing_list_item_version_id, pricing_list_item_version_no,
                billing_label, organisme_id, admission_coverage_id,
                coverage_resolution_mode, coverage_resolution_reason,
                repricing_reason, created_by_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            RETURNING *
        `, [
            data.chargeEventId, data.snapshotNo, data.isCurrent, data.supersedesSnapshotId,
            data.quantity, data.unitPrice, data.totalPrice,
            data.pricingSourceType, data.snapshotSource,
            data.pricingListId, data.pricingListCode, data.pricingListVersionNo,
            data.pricingListItemId, data.pricingListItemVersionId, data.pricingListItemVersionNo,
            data.billingLabel, data.organismeId, data.admissionCoverageId,
            data.coverageResolutionMode, data.coverageResolutionReason,
            data.repricingReason, data.createdByUserId
        ]);
        return res.rows[0];
    },

    async createDispatches(
        client: PoolClient,
        snapshotId: string,
        dispatches: Array<{ dispatch_type: string; sequence_no: number; amount: number }>
    ) {
        if (!dispatches.length) return [];
        const values: any[] = [];
        const placeholders: string[] = [];
        dispatches.forEach((d, i) => {
            const base = i * 4;
            placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
            values.push(snapshotId, d.dispatch_type, d.sequence_no, d.amount);
        });
        const res = await client.query(`
            INSERT INTO public.admission_charge_dispatches
                (admission_charge_snapshot_id, dispatch_type, sequence_no, amount)
            VALUES ${placeholders.join(', ')}
            RETURNING *
        `, values);
        return res.rows;
    },

    async setCurrentSnapshot(client: PoolClient, chargeEventId: string, snapshotId: string) {
        await client.query(`
            UPDATE public.admission_charge_events
            SET current_snapshot_id = $2
            WHERE id = $1
        `, [chargeEventId, snapshotId]);
    },

    async voidChargeEvent(
        client: PoolClient,
        data: { chargeEventId: string; userId: string | null; reason: string | null }
    ) {
        const res = await client.query(`
            UPDATE public.admission_charge_events
            SET status = 'VOIDED_BEFORE_POSTING',
                voided_at = NOW(),
                voided_by_user_id = $2,
                void_reason = $3
            WHERE id = $1
              AND status IN ('CAPTURED', 'PENDING_REVIEW', 'READY_TO_POST')
            RETURNING *
        `, [data.chargeEventId, data.userId, data.reason]);
        return res.rows[0] || null;
    },

    async getAdmissionByChargeEvent(client: PoolClient, chargeEventId: string) {
        const res = await client.query(`
            SELECT admission_id, status
            FROM public.admission_charge_events
            WHERE id = $1
        `, [chargeEventId]);
        return res.rows[0] || null;
    },

    // ---------------------------------------------
    // Reads (non-TX)
    // ---------------------------------------------

    async listChargesByAdmission(
        tenantId: string,
        admissionId: string,
        opts?: { includeVoided?: boolean }
    ) {
        const includeVoided = opts?.includeVoided === true;
        const statusFilter = includeVoided
            ? ''
            : `AND e.status <> 'VOIDED_BEFORE_POSTING'`;

        const events = await tenantQuery(tenantId, `
            SELECT
                e.*,
                ga.code_sih     AS global_act_code_sih,
                ga.libelle_sih  AS global_act_libelle_sih,
                ga.type_acte    AS global_act_type_acte,
                s.id                                AS current_snapshot_id_resolved,
                s.snapshot_no                       AS current_snapshot_no,
                s.unit_price_snapshot               AS current_unit_price,
                s.total_price_snapshot              AS current_total_price,
                s.currency_code                     AS current_currency_code,
                s.billing_label                     AS current_billing_label,
                s.pricing_list_code                 AS current_pricing_list_code,
                s.pricing_list_version_no           AS current_pricing_list_version_no,
                s.pricing_list_item_version_no      AS current_pricing_list_item_version_no,
                s.pricing_source_type               AS current_pricing_source_type,
                s.snapshot_source                   AS current_snapshot_source,
                s.quantity                          AS current_quantity
            FROM public.admission_charge_events e
            JOIN reference.global_actes ga ON ga.id = e.global_act_id
            LEFT JOIN public.admission_charge_snapshots s ON s.id = e.current_snapshot_id
            WHERE e.admission_id = $1
            ${statusFilter}
            ORDER BY e.captured_at DESC
        `, [admissionId]);

        if (events.length === 0) return [];

        const snapshotIds = events
            .map((e: any) => e.current_snapshot_id_resolved)
            .filter(Boolean);

        let dispatchMap: Map<string, any[]> = new Map();
        if (snapshotIds.length > 0) {
            const dispatches = await tenantQuery(tenantId, `
                SELECT * FROM public.admission_charge_dispatches
                WHERE admission_charge_snapshot_id = ANY($1)
                ORDER BY sequence_no ASC
            `, [snapshotIds]);
            dispatches.forEach((d: any) => {
                const list = dispatchMap.get(d.admission_charge_snapshot_id) || [];
                list.push(d);
                dispatchMap.set(d.admission_charge_snapshot_id, list);
            });
        }

        return events.map((e: any) => ({
            ...e,
            current_snapshot: e.current_snapshot_id_resolved
                ? {
                    id: e.current_snapshot_id_resolved,
                    snapshot_no: e.current_snapshot_no,
                    unit_price_snapshot: e.current_unit_price,
                    total_price_snapshot: e.current_total_price,
                    currency_code: e.current_currency_code,
                    billing_label: e.current_billing_label,
                    pricing_list_code: e.current_pricing_list_code,
                    pricing_list_version_no: e.current_pricing_list_version_no,
                    pricing_list_item_version_no: e.current_pricing_list_item_version_no,
                    pricing_source_type: e.current_pricing_source_type,
                    snapshot_source: e.current_snapshot_source,
                    quantity: e.current_quantity,
                    dispatches: dispatchMap.get(e.current_snapshot_id_resolved) || []
                }
                : null
        }));
    }
};
