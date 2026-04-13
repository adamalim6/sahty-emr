/**
 * LIMS Reception Service
 * Handles specimen intake at the laboratory — barcode lookup, receive, reject.
 * All status changes are atomic: updates lab_specimens + inserts lab_specimen_status_history.
 */
import { tenantQuery, tenantTransaction } from '../../db/tenantPg';
import { hprimOutboundService } from '../integrations/hprim/hprimOutboundService';

export const limsReceptionService = {

    /**
     * Fetch specimen by barcode with full contextual data
     */
    async getSpecimenByBarcode(tenantId: string, barcode: string) {
        // Normalize: some barcode scanners send § (section sign) instead of - (hyphen)
        const normalizedBarcode = barcode.replace(/§/g, '-');
        const rows = await tenantQuery<any>(tenantId, `
            SELECT 
                ls.id AS specimen_id,
                ls.barcode,
                ls.status,
                ls.rejected_reason,
                ls.received_at,
                ls.rejected_at,
                ls.created_at AS specimen_created_at,
                ls.last_status_changed_at,
                lc.collected_at,
                lc.id AS collection_id,
                tp.tenant_patient_id AS patient_id,
                tp.first_name AS patient_first_name,
                tp.last_name AS patient_last_name,
                iid.identity_value AS patient_ipp,
                rct.libelle AS container_label,
                rct.tube_color AS container_color,
                rst.libelle AS specimen_type_label
            FROM public.lab_specimens ls
            JOIN public.lab_collection_specimens lcs ON lcs.specimen_id = ls.id
            JOIN public.lab_collections lc ON lc.id = lcs.lab_collection_id
            JOIN public.patients_tenant tp ON tp.tenant_patient_id = lc.tenant_patient_id
            LEFT JOIN public.identity_ids iid ON iid.tenant_patient_id = tp.tenant_patient_id 
                AND iid.identity_type_code = 'LOCAL_MRN' AND iid.is_primary = true
            LEFT JOIN reference.lab_specimen_container_types lsct ON lsct.id = ls.lab_specimen_container_type_id
            LEFT JOIN reference.lab_container_types rct ON rct.id = lsct.container_type_id
            LEFT JOIN reference.lab_specimen_types rst ON rst.id = lsct.specimen_type_id
            WHERE ls.barcode = $1
            LIMIT 1
        `, [normalizedBarcode]);

        if (rows.length === 0) return null;

        // Fetch linked acts via lab_specimen_requests → lab_requests → global_actes
        const acts = await tenantQuery<{ act_id: string; libelle: string }>(tenantId, `
            SELECT DISTINCT ga.id AS act_id, ga.libelle_sih AS libelle
            FROM public.lab_specimen_requests lsr
            JOIN public.lab_requests lr ON lr.id = lsr.lab_request_id
            JOIN reference.global_actes ga ON ga.id = lr.global_act_id
            WHERE lsr.specimen_id = $1
            ORDER BY ga.libelle_sih
        `, [rows[0].specimen_id]);

        return { ...rows[0], acts };
    },

    /**
     * Receive a specimen — COLLECTED → RECEIVED
     */
    async receiveSpecimen(tenantId: string, specimenId: string, userId: string) {
        return tenantTransaction(tenantId, async (client) => {
            // Fetch current state
            const current = await client.query(
                `SELECT id, status FROM public.lab_specimens WHERE id = $1`,
                [specimenId]
            );
            if (current.rows.length === 0) throw new Error('Specimen not found');

            const oldStatus = current.rows[0].status;
            if (oldStatus === 'RECEIVED') throw new Error('Ce prélèvement a déjà été reçu.');
            if (oldStatus === 'REJECTED') throw new Error('Ce prélèvement a déjà été rejeté.');

            const now = new Date();

            // Update main table
            await client.query(`
                UPDATE public.lab_specimens
                SET status = 'RECEIVED',
                    received_at = $1,
                    received_by_user_id = $2,
                    last_status_changed_at = $1,
                    last_status_changed_by_user_id = $2
                WHERE id = $3
            `, [now, userId, specimenId]);

            // Insert history row
            await client.query(`
                INSERT INTO public.lab_specimen_status_history
                    (specimen_id, old_status, new_status, changed_at, changed_by_user_id)
                VALUES ($1, $2, 'RECEIVED', $3, $4)
            `, [specimenId, oldStatus, now, userId]);

            // HPRIM: Fire ORM generation after reception (non-blocking)
            hprimOutboundService.generateOrmForSpecimen(tenantId, specimenId)
                .catch(err => console.error('[HPRIM] ORM trigger failed (receiveSpecimen):', err.message));

            return { id: specimenId, status: 'RECEIVED', received_at: now };
        }, { userId });
    },

    /**
     * Reject a specimen — any status (except REJECTED) → REJECTED
     */
    async rejectSpecimen(tenantId: string, specimenId: string, userId: string, reason: string) {
        return tenantTransaction(tenantId, async (client) => {
            // Fetch current state
            const current = await client.query(
                `SELECT id, status FROM public.lab_specimens WHERE id = $1`,
                [specimenId]
            );
            if (current.rows.length === 0) throw new Error('Specimen not found');

            const oldStatus = current.rows[0].status;
            if (oldStatus === 'REJECTED') throw new Error('Ce prélèvement a déjà été rejeté.');

            const now = new Date();

            // Update main table
            await client.query(`
                UPDATE public.lab_specimens
                SET status = 'REJECTED',
                    rejected_reason = $1,
                    rejected_at = $2,
                    rejected_by_user_id = $3,
                    last_status_changed_at = $2,
                    last_status_changed_by_user_id = $3
                WHERE id = $4
            `, [reason, now, userId, specimenId]);

            // Insert history row
            await client.query(`
                INSERT INTO public.lab_specimen_status_history
                    (specimen_id, old_status, new_status, changed_at, changed_by_user_id, reason)
                VALUES ($1, $2, 'REJECTED', $3, $4, $5)
            `, [specimenId, oldStatus, now, userId, reason]);

            return { id: specimenId, status: 'REJECTED', rejected_reason: reason, rejected_at: now };
        }, { userId });
    },

    /**
     * Mark specimen as insufficient
     */
    async markInsufficientSpecimen(tenantId: string, specimenId: string, userId: string) {
        return tenantTransaction(tenantId, async (client) => {
            const current = await client.query(
                `SELECT id, status FROM public.lab_specimens WHERE id = $1`,
                [specimenId]
            );
            if (current.rows.length === 0) throw new Error('Specimen not found');

            const oldStatus = current.rows[0].status;
            if (oldStatus === 'INSUFFICIENT') throw new Error('Ce prélèvement est déjà marqué insuffisant.');
            if (oldStatus === 'REJECTED') throw new Error('Ce prélèvement a déjà été rejeté.');

            const now = new Date();

            await client.query(`
                UPDATE public.lab_specimens
                SET status = 'INSUFFICIENT',
                    last_status_changed_at = $1,
                    last_status_changed_by_user_id = $2
                WHERE id = $3
            `, [now, userId, specimenId]);

            await client.query(`
                INSERT INTO public.lab_specimen_status_history
                    (specimen_id, old_status, new_status, changed_at, changed_by_user_id)
                VALUES ($1, $2, 'INSUFFICIENT', $3, $4)
            `, [specimenId, oldStatus, now, userId]);

            return { id: specimenId, status: 'INSUFFICIENT' };
        }, { userId });
    }
};
