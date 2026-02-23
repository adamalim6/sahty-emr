import { getTenantPool } from '../db/tenantPg';
import { SurveillanceHourBucket } from '../models/surveillance';
import { tenantObservationCatalogService } from './tenantObservationCatalogService';

class SurveillanceService {
    async getTimeline(tenantId: string, tenantPatientId: string, admissionId: string | null, fromDate: string, toDate: string, flowsheetId?: string) {
        const pool = getTenantPool(tenantId);

        // 1. Fetch Flowsheet Structure (if requested)
        let flowsheetStructure = null;
        if (flowsheetId) {
            const flowsheets = await tenantObservationCatalogService.getFlowsheets(tenantId, true);
            flowsheetStructure = flowsheets.find((f: any) => f.id === flowsheetId);
        }

        // 2. Fetch JSONB Buckets
        const bucketsRes = await pool.query(`
            SELECT * FROM surveillance_hour_buckets
            WHERE tenant_id = $1 AND tenant_patient_id = $2
            AND bucket_start >= $3 AND bucket_start <= $4
            ORDER BY bucket_start ASC
        `, [tenantId, tenantPatientId, fromDate, toDate]);

        // 3. Fetch Prescription Timeline (joined with admin events)
        const timelineRes = await pool.query(`
            SELECT 
                pe.id as event_id,
                pe.prescription_id,
                pe.planned_date,
                p.product_id,
                p.commercial_name,
                p.molecule,
                p.route,
                p.created_by_first_name,
                p.created_by_last_name,
                ae.id as admin_id,
                ae.status as admin_status,
                ae.actual_date as admin_date,
                ae.performed_by as admin_by,
                ae.justification
            FROM prescription_events pe
            JOIN prescriptions p ON p.id = pe.prescription_id
            LEFT JOIN administration_events ae ON ae.prescription_event_id = pe.id
            WHERE p.tenant_patient_id = $1
            AND pe.planned_date >= $2 AND pe.planned_date <= $3
            ORDER BY pe.planned_date ASC
        `, [tenantPatientId, fromDate, toDate]);

        return {
            flowsheet: flowsheetStructure,
            buckets: bucketsRes.rows.map(this.mapBucket),
            timelineEvents: timelineRes.rows.map(this.mapTimelineEvent)
        };
    }

    async updateCell(tenantId: string, tenantPatientId: string, admissionId: string | null, bucketStart: string, parameterCode: string, value: any, expectedRevision: number, userId: string): Promise<SurveillanceHourBucket> {
        
        // --- Validation: Hard Limits ---
        const parameter = await tenantObservationCatalogService.getParameterByCode(tenantId, parameterCode);
        if (!parameter) {
            throw new Error(`Parameter '${parameterCode}' not found or inactive`);
        }
        
        if (parameter.valueType === 'number' && typeof value === 'number') {
            if (parameter.hardMin !== undefined && value < parameter.hardMin) {
                const err: any = new Error('LIMIT_VIOLATION');
                err.message = `La valeur saisie (${value}) est inférieure à la limite stricte (${parameter.hardMin}).`;
                throw err;
            }
            if (parameter.hardMax !== undefined && value > parameter.hardMax) {
                const err: any = new Error('LIMIT_VIOLATION');
                err.message = `La valeur saisie (${value}) est supérieure à la limite stricte (${parameter.hardMax}).`;
                throw err;
            }
        }

        const pool = getTenantPool(tenantId);
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            const now = new Date().toISOString();
            const cellData = { v: value, by: userId, at: now, n: 0 };
            
            // ExpectedRevision = 0 means the frontend assumes this bucket is completely new
            if (expectedRevision === 0) {
                const initialValues = { [parameterCode]: cellData };
                try {
                    const inserted = await client.query(`
                        INSERT INTO surveillance_hour_buckets (
                            tenant_id, admission_id, tenant_patient_id, bucket_start, values, revision, created_by_user_id, updated_by_user_id
                        ) VALUES ($1, $2, $3, $4, $5, 1, $6, $6)
                        RETURNING *
                    `, [tenantId, admissionId, tenantPatientId, bucketStart, initialValues, userId]);
                    await client.query('COMMIT');
                    return this.mapBucket(inserted.rows[0]);
                } catch (e: any) {
                    // 23505 = unique_violation. This implies someone instantiated the bucket just before us.
                    if (e.code === '23505') {
                        const current = await client.query(
                            `SELECT * FROM surveillance_hour_buckets WHERE tenant_id=$1 AND tenant_patient_id=$2 AND bucket_start=$3`,
                            [tenantId, tenantPatientId, bucketStart]
                        );
                        const err: any = new Error('REVISION_MISMATCH');
                        err.currentRow = this.mapBucket(current.rows[0]);
                        throw err;
                    }
                    throw e;
                }
            }

            // Regular update path: Row must exist and revision must match
            const existingRes = await client.query(`
                SELECT * FROM surveillance_hour_buckets
                WHERE tenant_id = $1 AND tenant_patient_id = $2 AND bucket_start = $3
                FOR UPDATE
            `, [tenantId, tenantPatientId, bucketStart]);

            if (existingRes.rows.length === 0) {
                 // Front-end thinks it exists but it was somehow deleted? Unlikely but handle it
                 throw new Error('BUCKET_NOT_FOUND');
            }

            const row = existingRes.rows[0];
            
            if (row.revision !== expectedRevision) {
                const err: any = new Error('REVISION_MISMATCH');
                err.currentRow = this.mapBucket(row);
                throw err;
            }

            // Update existing cell data natively with jsonb_set
            const currentValues = typeof row.values === 'string' ? JSON.parse(row.values) : row.values;
            const existingCell = currentValues[parameterCode];
            
            if (existingCell) {
                cellData.n = (existingCell.n || 0) + 1;
            }

            const updated = await client.query(`
                UPDATE surveillance_hour_buckets
                SET 
                    values = jsonb_set(values, '{${parameterCode}}', $1::jsonb, true),
                    revision = revision + 1,
                    updated_by_user_id = $2
                WHERE id = $3
                RETURNING *
            `, [JSON.stringify(cellData), userId, row.id]);

            await client.query('COMMIT');
            return this.mapBucket(updated.rows[0]);

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    private mapBucket(row: any): SurveillanceHourBucket {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            admissionId: row.admission_id,
            tenantPatientId: row.tenant_patient_id,
            bucketStart: row.bucket_start,
            values: typeof row.values === 'string' ? JSON.parse(row.values) : row.values,
            revision: row.revision,
            updatedAt: row.updated_at,
            updatedByUserId: row.updated_by_user_id,
            createdAt: row.created_at,
            createdByUserId: row.created_by_user_id
        };
    }

    private mapTimelineEvent(row: any) {
        return {
            eventId: row.event_id,
            prescriptionId: row.prescription_id,
            plannedDate: row.planned_date,
            prescriptionData: {
                productId: row.product_id,
                commercialName: row.commercial_name,
                molecule: row.molecule,
                route: row.route,
                prescriber: row.created_by_last_name ? `${row.created_by_first_name} ${row.created_by_last_name}` : 'Médecin'
            },
            administration: row.admin_id ? {
                id: row.admin_id,
                status: row.admin_status,
                actualDate: row.admin_date,
                performedBy: row.admin_by,
                justification: row.justification
            } : null
        };
    }
}

export const surveillanceService = new SurveillanceService();
