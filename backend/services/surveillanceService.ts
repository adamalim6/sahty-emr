import { getTenantPool } from '../db/tenantPg';
import { SurveillanceHourBucket } from '../models/surveillance';
import { tenantObservationCatalogService } from './tenantObservationCatalogService';
import { hydricEngineService } from './hydricEngineService';

class SurveillanceService {
    async getTimeline(tenantId: string, tenantPatientId: string, fromDate: string, toDate: string, flowsheetId?: string) {
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

        // 3. Fetch Prescription Timeline (joined with admin events and reference models for care_category)
        const timelineRes = await pool.query(`
            SELECT 
                pe.id as event_id,
                pe.prescription_id,
                pe.scheduled_at as planned_date,
                pe.duration as admin_duration,
                pe.requires_end_event,
                pe.requires_fluid_info,
                p.prescription_type,
                (p.details->>'productId') as product_id,
                ae.events as admin_events
            FROM prescription_events pe
            JOIN prescriptions p ON p.id = pe.prescription_id
            LEFT JOIN LATERAL (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', ae_inner.id,
                        'action_type', CASE WHEN ae_inner.action_type = 'PERFUSION_START' THEN 'started' WHEN ae_inner.action_type = 'PERFUSION_END' THEN 'ended' ELSE ae_inner.action_type END,
                        'occurred_at', ae_inner.occurred_at,
                        'actual_start_at', ae_inner.actual_start_at,
                        'actual_end_at', ae_inner.actual_end_at,
                        'volume_administered_ml', ae_inner.volume_administered_ml,
                        'performed_by', ae_inner.performed_by_user_id,
                        'performed_by_first_name', ae_inner.performed_by_first_name,
                        'performed_by_last_name', ae_inner.performed_by_last_name,
                        'note', ae_inner.note,
                        'status', ae_inner.status,
                        'linked_event_id', ae_inner.linked_event_id,
                        'reaction', (
                            SELECT jsonb_build_object(
                                'reaction_type', tr.reaction_type,
                                'description', tr.description,
                                'actions_taken', tr.actions_taken
                            ) FROM transfusion_reactions tr WHERE tr.administration_event_id = ae_inner.id
                        )
                    ) ORDER BY ae_inner.occurred_at ASC
                ), '[]'::jsonb) as events
                FROM administration_events ae_inner
                WHERE ae_inner.prescription_event_id = pe.id
            ) ae ON true
            WHERE p.tenant_patient_id = $1
            AND pe.scheduled_at >= $2::timestamptz AND pe.scheduled_at <= $3::timestamptz
            ORDER BY pe.scheduled_at ASC
        `, [tenantPatientId, fromDate, toDate]);

        return {
            flowsheet: flowsheetStructure,
            buckets: bucketsRes.rows.map(this.mapBucket),
            timelineEvents: timelineRes.rows.map(this.mapTimelineEvent)
        };
    }

    async updateCell(tenantId: string, tenantPatientId: string, recordedAt: string, parameterId: string, parameterCode: string, value: any, userId: string): Promise<SurveillanceHourBucket> {
        const recordDate = new Date(recordedAt);
        recordDate.setMinutes(0, 0, 0);
        const bucketStart = recordDate.toISOString();

        // --- Validation ---
        const parameter = await tenantObservationCatalogService.getParameterByCode(tenantId, parameterCode);
        if (!parameter) {
            throw new Error(`Parameter '${parameterCode}' not found or inactive`);
        }
        
        if (parameter.source === 'calculated') {
            throw new Error(`Le paramètre '${parameter.label}' est calculé automatiquement et ne peut pas être saisi manuellement.`);
        }
        
        if (value !== null && parameter.valueType === 'number' && typeof value === 'number') {
            if (parameter.hardMin !== undefined && value < parameter.hardMin) {
                throw new Error(`La valeur saisie (${value}) est inférieure à la limite stricte (${parameter.hardMin}).`);
            }
            if (parameter.hardMax !== undefined && value > parameter.hardMax) {
                throw new Error(`La valeur saisie (${value}) est supérieure à la limite stricte (${parameter.hardMax}).`);
            }
        }

        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Unconditionally insert EAV event. Postgres Trigger handles bucket aggregation.
            let vNum = null, vTxt = null, vBool = null;
            if (value !== null) {
                if (parameter.valueType === 'number' || parameter.valueType === 'numeric') vNum = Number(value);
                else if (parameter.valueType === 'boolean') vBool = Boolean(value);
                else vTxt = String(value);
            }

    
            await client.query(`
                INSERT INTO surveillance_values_events (
                    tenant_id, tenant_patient_id, parameter_id, parameter_code, 
                    bucket_start, value_numeric, value_text, value_boolean, recorded_by, recorded_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            `, [tenantId, tenantPatientId, parameterId, parameterCode, bucketStart, vNum, vTxt, vBool, userId]);

            // Trigger Hydric Engine if this was a manual hydric parameter update
            if (parameter.source === 'manual' && (parameter.isHydricInput || parameter.isHydricOutput)) {
                await hydricEngineService.recalculateBuckets(tenantId, tenantPatientId, bucketStart, bucketStart, client);
            }

            // 2. Read the derived bucket state
            const result = await client.query(`
                SELECT * FROM surveillance_hour_buckets 
                WHERE tenant_patient_id = $1 AND bucket_start = $2
            `, [tenantPatientId, bucketStart]);

            await client.query('COMMIT');
            return this.mapBucket(result.rows[0]);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error("Failed to UPSERT surveillance cell details:", e);
            throw e;
        } finally {
            client.release();
        }
    }

    private mapBucket(row: any): SurveillanceHourBucket {
        return {
            id: row.id,
            tenantId: row.tenant_id,
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
            adminDuration: row.admin_duration,
            requires_end_event: !!row.requires_end_event,
            requires_fluid_info: !!row.requires_fluid_info,
            prescriptionData: {
                prescriptionType: row.prescription_type,
                productId: row.product_id,
                prescriber: row.created_by_last_name ? `${row.created_by_first_name} ${row.created_by_last_name}` : 'Médecin'
            },
            administrationEvents: Array.isArray(row.admin_events) ? row.admin_events : []
        };
    }
}

export const surveillanceService = new SurveillanceService();
