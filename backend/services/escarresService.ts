import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { PoolClient } from 'pg';

export interface CreateEscarrePayload {
    tenantPatientId: string;
    posX: number;
    posY: number;
    posZ: number;
    bodySide?: string;
    bodyRegion?: string;
    snapshot: CreateSnapshotPayload;
}

export interface CreateSnapshotPayload {
    stage: number;
    lengthMm?: number;
    widthMm?: number;
    depthMm?: number;
    tissueType?: string;
    exudateAmount?: string;
    odor?: string;
    painScale?: number;
    infectionSigns?: boolean;
    dressing?: string;
    notes?: string;
    photoUrl?: string;
    recordedAt?: string;
}

export const EscarresService = {

    async getEscarresForPatient(tenantId: string, tenantPatientId: string) {
        // Optimized query: Fetch base escarre + exactly 1 latest snapshot via LATERAL join
        const sql = `
            SELECT 
                e.id,
                e.tenant_patient_id,
                e.created_at,
                e.created_by,
                e.is_active,
                e.pos_x,
                e.pos_y,
                e.pos_z,
                e.body_side,
                e.body_region,
                s.id AS latest_snapshot_id,
                s.recorded_at,
                s.recorded_by,
                s.stage,
                s.length_mm,
                s.width_mm,
                s.depth_mm,
                s.tissue_type,
                s.exudate_amount,
                s.odor,
                s.pain_scale,
                s.infection_signs,
                s.dressing,
                s.notes,
                s.photo_url
            FROM public.escarres e
            LEFT JOIN LATERAL (
                SELECT *
                FROM public.escarre_snapshots snap
                WHERE snap.escarre_id = e.id
                  AND snap.tenant_id = e.tenant_id
                ORDER BY snap.recorded_at DESC
                LIMIT 1
            ) s ON true
            WHERE e.tenant_id = $1 AND e.tenant_patient_id = $2
            ORDER BY e.created_at DESC
        `;
        const result = await tenantQuery(tenantId, sql, [tenantId, tenantPatientId]);
        
        return result.map(row => ({
            id: row.id,
            tenantPatientId: row.tenant_patient_id,
            isActive: row.is_active,
            createdAt: row.created_at,
            createdBy: row.created_by,
            posX: row.pos_x,
            posY: row.pos_y,
            posZ: row.pos_z,
            bodySide: row.body_side,
            bodyRegion: row.body_region,
            latestSnapshot: row.latest_snapshot_id ? {
                id: row.latest_snapshot_id,
                recordedAt: row.recorded_at,
                recordedBy: row.recorded_by,
                stage: row.stage,
                lengthMm: row.length_mm,
                widthMm: row.width_mm,
                depthMm: row.depth_mm,
                tissueType: row.tissue_type,
                exudateAmount: row.exudate_amount,
                odor: row.odor,
                painScale: row.pain_scale,
                infectionSigns: row.infection_signs,
                dressing: row.dressing,
                notes: row.notes,
                photoUrl: row.photo_url
            } : null
        }));
    },

    async createEscarre(tenantId: string, createdBy: string | null, payload: CreateEscarrePayload) {
        return await tenantTransaction(tenantId, async (client: PoolClient) => {
            
            // 1. Validate patient belongs to tenant
            const patCheck = await client.query(
                `SELECT tenant_patient_id FROM public.patients_tenant WHERE tenant_id = $1 AND tenant_patient_id = $2`,
                [tenantId, payload.tenantPatientId]
            );
            if (patCheck.rows.length === 0) {
                throw new Error("Patient not found or inaccessible in this tenant");
            }

            // 2. Insert Base Escarre
            const escSql = `
                INSERT INTO public.escarres (
                    tenant_id, tenant_patient_id, created_by, pos_x, pos_y, pos_z, body_side, body_region
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            const escValues = [
                tenantId, payload.tenantPatientId, createdBy, 
                payload.posX, payload.posY, payload.posZ, 
                payload.bodySide || null, payload.bodyRegion || null
            ];
            const escRes = await client.query(escSql, escValues);
            const newEscarre = escRes.rows[0];

            // 3. Insert Initial Snapshot
            const s = payload.snapshot;
            const snapSql = `
                INSERT INTO public.escarre_snapshots (
                    tenant_id, escarre_id, recorded_at, recorded_by,
                    stage, length_mm, width_mm, depth_mm,
                    tissue_type, exudate_amount, odor, pain_scale,
                    infection_signs, dressing, notes, photo_url
                ) VALUES (
                    $1, $2, COALESCE($3::timestamptz, NOW()), $4,
                    $5, $6, $7, $8,
                    $9, $10, $11, $12,
                    $13, $14, $15, $16
                )
                RETURNING *
            `;
            const snapValues = [
                tenantId, newEscarre.id, s.recordedAt || null, createdBy,
                s.stage, s.lengthMm || null, s.widthMm || null, s.depthMm || null,
                s.tissueType || null, s.exudateAmount || null, s.odor || null, s.painScale || null,
                s.infectionSigns || null, s.dressing || null, s.notes || null, s.photoUrl || null
            ];
            const snapRes = await client.query(snapSql, snapValues);

            return {
                ...this._mapEscarreRow(newEscarre),
                latestSnapshot: this._mapSnapshotRow(snapRes.rows[0])
            };
        });
    },

    async getEscarreWithHistory(tenantId: string, escarreId: string) {
        // Base Escarre
        const escSql = `SELECT * FROM public.escarres WHERE tenant_id = $1 AND id = $2`;
        const escRes = await tenantQuery(tenantId, escSql, [tenantId, escarreId]);
        if (escRes.length === 0) throw new Error("Escarre not found");
        const base = this._mapEscarreRow(escRes[0]);

        // History
        const snapSql = `SELECT * FROM public.escarre_snapshots WHERE tenant_id = $1 AND escarre_id = $2 ORDER BY recorded_at DESC`;
        const snapRes = await tenantQuery(tenantId, snapSql, [tenantId, escarreId]);
        const history = snapRes.map(this._mapSnapshotRow);

        return {
            ...base,
            latestSnapshot: history.length > 0 ? history[0] : null,
            history
        };
    },

    async addSnapshot(tenantId: string, escarreId: string, recordedBy: string | null, payload: CreateSnapshotPayload) {
        // Verify escarre belongs to tenant
        const checkSql = `SELECT id FROM public.escarres WHERE tenant_id = $1 AND id = $2`;
        const checkRes = await tenantQuery(tenantId, checkSql, [tenantId, escarreId]);
        if (checkRes.length === 0) throw new Error("Escarre not found");

        const snapSql = `
            INSERT INTO public.escarre_snapshots (
                tenant_id, escarre_id, recorded_at, recorded_by,
                stage, length_mm, width_mm, depth_mm,
                tissue_type, exudate_amount, odor, pain_scale,
                infection_signs, dressing, notes, photo_url
            ) VALUES (
                $1, $2, COALESCE($3::timestamptz, NOW()), $4,
                $5, $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14, $15, $16
            )
            RETURNING *
        `;
        const snapValues = [
            tenantId, escarreId, payload.recordedAt || null, recordedBy,
            payload.stage, payload.lengthMm || null, payload.widthMm || null, payload.depthMm || null,
            payload.tissueType || null, payload.exudateAmount || null, payload.odor || null, payload.painScale || null,
            payload.infectionSigns || null, payload.dressing || null, payload.notes || null, payload.photoUrl || null
        ];
        
        const res = await tenantQuery(tenantId, snapSql, snapValues);
        return this._mapSnapshotRow(res[0]);
    },

    async deactivateEscarre(tenantId: string, escarreId: string) {
        const sql = `
            UPDATE public.escarres
            SET is_active = false, updated_at = NOW()
            WHERE tenant_id = $1 AND id = $2
            RETURNING *
        `;
        const res = await tenantQuery(tenantId, sql, [tenantId, escarreId]);
        if (res.length === 0) throw new Error("Escarre not found");
        return this._mapEscarreRow(res[0]);
    },

    // --- Mappers ---
    _mapEscarreRow(row: any) {
        return {
            id: row.id,
            tenantPatientId: row.tenant_patient_id,
            isActive: row.is_active,
            createdAt: row.created_at,
            createdBy: row.created_by,
            posX: row.pos_x,
            posY: row.pos_y,
            posZ: row.pos_z,
            bodySide: row.body_side,
            bodyRegion: row.body_region
        };
    },

    _mapSnapshotRow(row: any) {
        if (!row) return null;
        return {
            id: row.id,
            escarreId: row.escarre_id,
            recordedAt: row.recorded_at,
            recordedBy: row.recorded_by,
            stage: row.stage,
            lengthMm: row.length_mm,
            widthMm: row.width_mm,
            depthMm: row.depth_mm,
            tissueType: row.tissue_type,
            exudateAmount: row.exudate_amount,
            odor: row.odor,
            painScale: row.pain_scale,
            infectionSigns: row.infection_signs,
            dressing: row.dressing,
            notes: row.notes,
            photoUrl: row.photo_url
        };
    }
};
