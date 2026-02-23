import { Prescription, PrescriptionData, PrescriptionEvent, AdministrationEvent } from '../models/prescription';
import { patientTenantService } from './patientTenantService';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { generateDoseSchedule } from '../utils/prescriptionScheduler';

export class PrescriptionService {
    
    // Get all prescriptions for a specific patient
    async getPrescriptionsByPatient(tenantId: string, patientId: string): Promise<Prescription[]> {
        const query = `
            SELECT
              p.*,
              CASE
                WHEN p.stopped_at IS NOT NULL THEN 'STOPPED'
                WHEN p.paused_at IS NOT NULL THEN 'PAUSED'
                WHEN NOT EXISTS (
                  SELECT 1
                  FROM public.prescription_events pe
                  WHERE pe.tenant_id = p.tenant_id
                    AND pe.prescription_id = p.id
                    AND (
                      pe.scheduled_at
                      + (COALESCE(pe.duration, 0) || ' minutes')::interval
                    ) > now()
                ) THEN 'ELAPSED'
                ELSE 'ACTIVE'
              END AS derived_status
            FROM public.prescriptions p
            WHERE p.tenant_id = $1
              AND p.tenant_patient_id = $2
            ORDER BY p.created_at DESC;
        `;
        const res = await tenantQuery<any>(tenantId, query, [tenantId, patientId]);
        
        return res.map(row => ({
            id: row.id,
            patientId: row.tenant_patient_id,
            data: {
                ...row.details,
                conditionComment: row.condition_comment,
                prescriptionType: row.prescription_type
            } as any,
            status: row.status,
            derived_status: row.derived_status,
            paused_at: row.paused_at,
            paused_by: row.paused_by,
            stopped_at: row.stopped_at,
            stopped_by: row.stopped_by,
            stopped_reason: row.stopped_reason,
            createdAt: row.created_at,
            createdBy: row.created_by,
            createdByFirstName: row.created_by_first_name,
            createdByLastName: row.created_by_last_name
        }));
    }

    async createPrescription(tenantId: string, patientId: string, admissionId: string, data: PrescriptionData, createdBy: string = 'system', createdByFirstName?: string, createdByLastName?: string, clientId?: string): Promise<Prescription> {
        
        // 1. Separate Header vs Details
        const pType = data.prescriptionType || 'medication';
        const comment = data.conditionComment || null;
        
        // Extract scheduler params from frontend payload (canonical names)
        const scheduleType = data.schedule_type; // canonical name
        const adminMode = data.adminMode;
        const adminDuration = data.adminDuration;
        const skippedEvents = data.schedule?.skippedEvents || [];
        const manuallyAdjustedEvents = data.schedule?.manuallyAdjustedEvents || {};

        // 2. Sanitize JSONB for storage
        const details = this.sanitizeDetailsForStorage(data, pType);

        return await tenantTransaction(tenantId, async (client: any) => {
            const queryPrescription = `
                INSERT INTO prescriptions (
                    tenant_id, tenant_patient_id, admission_id, 
                    prescription_type, condition_comment, status, details, 
                    created_by, created_by_first_name, created_by_last_name
                ) 
                VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7, $8, $9)
                RETURNING id, created_at
            `;

            const pRes = await client.query(queryPrescription, [
                tenantId, patientId, admissionId,
                pType, comment, JSON.stringify(details),
                createdBy, createdByFirstName || null, createdByLastName || null
            ]);

            const newId = pRes.rows[0].id;
            const newCreatedAt = pRes.rows[0].created_at;

            // 3. Generate Schedule Doses and Insert into prescription_events (PLAN ONLY)
            // Use raw frontend values for scheduler (scheduler expects old field names)
            if (data.schedule) {
                const scheduleResult = generateDoseSchedule(data.schedule, pType, scheduleType, adminMode, adminDuration, {
                    skippedEvents,
                    manuallyAdjustedEvents
                });

                // Parse adminDuration "HH:MM" to minutes for continuous therapies
                let durationMinutes: number | null = null;
                if (adminMode === 'continuous' && adminDuration) {
                    const parts = adminDuration.split(':');
                    if (parts.length === 2) {
                        durationMinutes = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
                        if (durationMinutes === 0) durationMinutes = null;
                    }
                }

                if (scheduleResult.scheduledDoses && scheduleResult.scheduledDoses.length > 0) {
                    for (const dose of scheduleResult.scheduledDoses) {
                        const eventQuery = `
                            INSERT INTO prescription_events (
                                tenant_id, prescription_id, admission_id,
                                scheduled_at, duration, status
                            ) VALUES ($1, $2, $3, $4, $5, $6)
                        `;
                        
                        const scheduledAt = new Date(dose.plannedDateTime);
                        const status = dose.isSkipped ? 'cancelled' : 'scheduled';
                        
                        await client.query(eventQuery, [
                            tenantId, newId, admissionId,
                            scheduledAt, durationMinutes, status
                        ]);
                    }
                }
            }

            // No administration_events rows at creation time — plan only.

            return {
                id: newId,
                patientId,
                data,
                createdAt: newCreatedAt,
                createdBy,
                createdByFirstName: createdByFirstName || undefined,
                createdByLastName: createdByLastName || undefined,
                client_id: clientId
            };
        });
    }

    /**
     * Sanitize the JSONB details before storage:
     * - Strip medication-only fields from non-medication types
     * - Keep transfusion exception fields (qty, unit, adminDuration)
     * - Remove header fields already stored in PostgreSQL columns
     */
    private sanitizeDetailsForStorage(data: PrescriptionData, prescriptionType: string): Record<string, any> {
        const raw: Record<string, any> = { ...data };

        // Remove header fields (stored in PostgreSQL columns, not JSONB)
        delete raw.conditionComment;
        delete raw.prescriptionType;
        // Remove legacy 'type' if present (canonical is schedule_type)
        delete raw.type;

        // --- Strip medication-only fields from non-medication types ---
        const MEDICATION_ONLY_FIELDS = [
            'molecule', 'commercialName', 'moleculeId', 'productId',
            'unit', 'route', 'qty', 'solvent',
            'adminMode', 'adminDuration',
            'substitutable', 'dilutionRequired', 'databaseMode'
        ];

        // Transfusion exception: keeps qty, unit, adminDuration, route
        const TRANSFUSION_KEEP = ['qty', 'unit', 'adminDuration', 'route'];

        if (prescriptionType !== 'medication') {
            for (const field of MEDICATION_ONLY_FIELDS) {
                if (prescriptionType === 'transfusion' && TRANSFUSION_KEEP.includes(field)) {
                    continue; // Keep for transfusion
                }
                delete raw[field];
            }
        }

        return raw;
    }

    // Delete a prescription by ID
    async deletePrescription(tenantId: string, id: string): Promise<boolean> {
        const query = `DELETE FROM prescriptions WHERE id = $1 RETURNING id`;
        const res = await tenantQuery(tenantId, query, [id]);
        return res.length > 0;
    }

    // Get a single prescription by ID
    async getPrescriptionById(tenantId: string, id: string): Promise<Prescription | undefined> {
        const query = `
            SELECT
              p.*,
              CASE
                WHEN p.stopped_at IS NOT NULL THEN 'STOPPED'
                WHEN p.paused_at IS NOT NULL THEN 'PAUSED'
                WHEN NOT EXISTS (
                  SELECT 1
                  FROM public.prescription_events pe
                  WHERE pe.tenant_id = p.tenant_id
                    AND pe.prescription_id = p.id
                    AND (
                      pe.scheduled_at
                      + (COALESCE(pe.duration, 0) || ' minutes')::interval
                    ) > now()
                ) THEN 'ELAPSED'
                ELSE 'ACTIVE'
              END AS derived_status
            FROM public.prescriptions p
            WHERE p.id = $1
        `;
        const res = await tenantQuery<any>(tenantId, query, [id]);
        if (res.length === 0) return undefined;

        const row = res[0];
        return {
            id: row.id,
            patientId: row.tenant_patient_id,
            data: {
                ...row.details,
                conditionComment: row.condition_comment,
                prescriptionType: row.prescription_type
            } as any,
            status: row.status,
            derived_status: row.derived_status,
            paused_at: row.paused_at,
            paused_by: row.paused_by,
            stopped_at: row.stopped_at,
            stopped_by: row.stopped_by,
            stopped_reason: row.stopped_reason,
            createdAt: row.created_at,
            createdBy: row.created_by,
            createdByFirstName: row.created_by_first_name,
            createdByLastName: row.created_by_last_name
        };
    }

    // --- PAUSE / RESUME / STOP ---
    async pausePrescription(tenantId: string, id: string, userId: string): Promise<void> {
        const checkQuery = `SELECT status, stopped_at FROM prescriptions WHERE id = $1`;
        const res = await tenantQuery<{status: string, stopped_at: Date | null}>(tenantId, checkQuery, [id]);
        if (res.length > 0 && res[0].stopped_at) {
            throw new Error("Cannot pause a stopped prescription.");
        }
        const query = `
            UPDATE prescriptions
            SET status = 'PAUSED', paused_at = now(), paused_by = $2
            WHERE id = $1 AND stopped_at IS NULL
        `;
        await tenantQuery(tenantId, query, [id, userId]);
    }

    async resumePrescription(tenantId: string, id: string): Promise<void> {
        const checkQuery = `SELECT status, stopped_at FROM prescriptions WHERE id = $1`;
        const res = await tenantQuery<{status: string, stopped_at: Date | null}>(tenantId, checkQuery, [id]);
        if (res.length > 0 && res[0].stopped_at) {
            throw new Error("Cannot resume a stopped prescription.");
        }
        const query = `
            UPDATE prescriptions
            SET status = 'ACTIVE', paused_at = NULL, paused_by = NULL
            WHERE id = $1 AND stopped_at IS NULL
        `;
        await tenantQuery(tenantId, query, [id]);
    }

    async stopPrescription(tenantId: string, id: string, userId: string, reason?: string): Promise<void> {
        const query = `
            UPDATE prescriptions
            SET status = 'STOPPED', stopped_at = now(), stopped_by = $2, stopped_reason = $3
            WHERE id = $1
        `;
        await tenantQuery(tenantId, query, [id, userId, reason || null]);
    }

    // Get all patients who have prescriptions with their info, EXCLUDING biology prescriptions
    async getPatientsWithPrescriptions(tenantId: string) {
        // Find unique patients who have non-biology prescriptions
        const query = `
            SELECT tenant_patient_id, COUNT(id) as rx_count 
            FROM prescriptions 
            WHERE prescription_type != 'biology'
            GROUP BY tenant_patient_id
        `;
        const res = await tenantQuery<{tenant_patient_id: string, rx_count: string}>(tenantId, query);
        
        const patientsWithPrescriptions = await Promise.all(res.map(async (row) => {
            const patient = await patientTenantService.getTenantPatient(tenantId, row.tenant_patient_id);
            if (!patient) return null;

            return {
                id: patient.tenantPatientId,
                ipp: patient.medicalRecordNumber, 
                firstName: patient.firstName,
                lastName: patient.lastName,
                gender: patient.gender,
                dateOfBirth: patient.dateOfBirth,
                cin: "N/A", 
                prescriptionCount: parseInt(row.rx_count, 10)
            };
        }));

        return patientsWithPrescriptions.filter(p => p !== null);
    }

    // --- EXECUTION MANAGEMENT (Epic-like: plan + admin events) ---

    /**
     * Get executions for a prescription.
     * Returns backward-compatible format: each scheduled event with its latest admin action.
     */
    async getExecutions(tenantId: string, prescriptionId: string): Promise<any[]> {
        // Get all planned events with their latest administration action
        const query = `
            SELECT 
                pe.id,
                pe.prescription_id,
                pe.scheduled_at,
                pe.status as plan_status,
                -- Latest admin action (if any)
                latest_admin.action_type,
                latest_admin.occurred_at as admin_occurred_at,
                latest_admin.actual_start_at,
                latest_admin.actual_end_at,
                latest_admin.performed_by,
                latest_admin.note
            FROM prescription_events pe
            LEFT JOIN LATERAL (
                SELECT ae.*
                FROM administration_events ae
                WHERE ae.prescription_event_id = pe.id
                ORDER BY ae.occurred_at DESC
                LIMIT 1
            ) latest_admin ON true
            WHERE pe.prescription_id = $1
            ORDER BY pe.scheduled_at ASC
        `;
        const res = await tenantQuery<any>(tenantId, query, [prescriptionId]);
        
        // Map back to legacy format for frontend monitoring sheet compatibility
        return res.map((row: any) => ({
            id: row.id,
            prescriptionId: row.prescription_id,
            plannedDate: row.scheduled_at.toISOString(),
            actualDate: row.actual_start_at ? row.actual_start_at.toISOString() : undefined,
            // Compute effective status from admin action or plan status
            status: this.computeEffectiveStatus(row.plan_status, row.action_type),
            justification: row.note || undefined,
            performedBy: row.performed_by || undefined,
            updatedAt: row.admin_occurred_at ? row.admin_occurred_at : undefined
        }));
    }

    /**
     * Compute the effective status from plan status + latest admin action for backward compatibility.
     */
    private computeEffectiveStatus(planStatus: string, actionType: string | null): string {
        if (!actionType) {
            // No admin action yet — use plan status, map to legacy values
            if (planStatus === 'cancelled') return 'skipped';
            return 'planned';
        }
        // Map action types to legacy status values
        switch (actionType) {
            case 'completed': return 'done';
            case 'started': return 'in_progress';
            case 'refused': return 'skipped';
            case 'skipped': return 'skipped';
            case 'failed': return 'failed';
            case 'stopped': return 'stopped';
            case 'attempted': return 'in_progress';
            default: return actionType;
        }
    }

    /**
     * Record or update an execution (backward-compatible with legacy API).
     * Now inserts into administration_events instead of modifying prescription_events.
     */
    async recordExecution(tenantId: string, execution: { 
        prescriptionId: string, 
        plannedDate: string, 
        status?: string, 
        justification?: string, 
        performedBy?: string, 
        actualDate?: string 
    }): Promise<any> {

        // Enforce safety rules: block administration if PAUSED or STOPPED
        const checkPQuery = `SELECT paused_at, stopped_at FROM prescriptions WHERE id = $1`;
        const checkPRes = await tenantQuery<{paused_at: Date | null, stopped_at: Date | null}>(tenantId, checkPQuery, [execution.prescriptionId]);
        if (checkPRes.length > 0) {
            if (checkPRes[0].stopped_at) throw new Error("Cannot execute: Prescription is STOPPED.");
            if (checkPRes[0].paused_at) throw new Error("Cannot execute: Prescription is PAUSED.");
        }
        
        // Find the prescription_event by scheduled_at match
        const selectQuery = `
            SELECT id FROM prescription_events 
            WHERE prescription_id = $1 AND scheduled_at = $2
        `;
        const selectRes = await tenantQuery<{id: string}>(tenantId, selectQuery, [
            execution.prescriptionId, 
            new Date(execution.plannedDate)
        ]);

        let eventId: string;

        if (selectRes.length > 0) {
            eventId = selectRes[0].id;
        } else {
            // Event doesn't exist yet (drift recovery) — create it as scheduled
            const insertEventQuery = `
                INSERT INTO prescription_events (
                    tenant_id, prescription_id, scheduled_at, status
                ) VALUES ($1, $2, $3, 'scheduled')
                RETURNING id
            `;
            const insertRes = await tenantQuery<{id: string}>(tenantId, insertEventQuery, [
                tenantId,
                execution.prescriptionId,
                new Date(execution.plannedDate)
            ]);
            eventId = insertRes[0].id;
        }

        // Map legacy status to action_type
        const actionType = this.mapStatusToActionType(execution.status || 'planned');

        // Insert administration event
        const actualStart = execution.actualDate ? new Date(execution.actualDate) : null;
        const adminInsertQuery = `
            INSERT INTO administration_events (
                tenant_id, prescription_event_id, action_type, occurred_at,
                actual_start_at, performed_by, note
            ) VALUES ($1, $2, $3, now(), $4, $5, $6)
            RETURNING *
        `;
        const adminRes = await tenantQuery<any>(tenantId, adminInsertQuery, [
            tenantId,
            eventId,
            actionType,
            actualStart,
            execution.performedBy || null,
            execution.justification || null
        ]);

        const r = adminRes[0];
        return {
            id: eventId,
            prescriptionId: execution.prescriptionId,
            plannedDate: execution.plannedDate,
            actualDate: r.actual_start_at ? r.actual_start_at.toISOString() : undefined,
            status: execution.status || 'planned',
            justification: r.note || undefined,
            performedBy: r.performed_by || undefined,
            updatedAt: r.occurred_at
        };
    }

    /**
     * Map legacy frontend status values to administration action types.
     */
    private mapStatusToActionType(status: string): string {
        switch (status) {
            case 'done': return 'completed';
            case 'skipped': return 'skipped';
            case 'failed': return 'failed';
            case 'in_progress': return 'started';
            case 'planned': return 'attempted';
            default: return status; // pass through for new action types
        }
    }

    /**
     * NEW: Explicit administration action logging (Epic-like)
     */
    async logAdministrationAction(
        tenantId: string,
        prescriptionEventId: string,
        actionType: string,
        payload?: {
            actualStartAt?: Date;
            actualEndAt?: Date;
            performedBy?: string;
            performedByUserId?: string;
            note?: string;
        }
    ): Promise<AdministrationEvent> {
        // Enforce safety rules via join back to prescriptions
        const checkSafetyQuery = `
            SELECT p.paused_at, p.stopped_at 
            FROM prescriptions p
            JOIN prescription_events pe ON pe.prescription_id = p.id
            WHERE pe.id = $1
        `;
        const checkSafetyRes = await tenantQuery<{paused_at: Date | null, stopped_at: Date | null}>(tenantId, checkSafetyQuery, [prescriptionEventId]);
        if (checkSafetyRes.length > 0) {
            if (checkSafetyRes[0].stopped_at) throw new Error("Cannot log administration action: Prescription is STOPPED.");
            if (checkSafetyRes[0].paused_at) throw new Error("Cannot log administration action: Prescription is PAUSED.");
        }

        const query = `
            INSERT INTO administration_events (
                tenant_id, prescription_event_id, action_type, occurred_at,
                actual_start_at, actual_end_at, performed_by, performed_by_user_id, note
            ) VALUES ($1, $2, $3, now(), $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const res = await tenantQuery<any>(tenantId, query, [
            tenantId,
            prescriptionEventId,
            actionType,
            payload?.actualStartAt || null,
            payload?.actualEndAt || null,
            payload?.performedBy || null,
            payload?.performedByUserId || null,
            payload?.note || null
        ]);

        const row = res[0];
        return {
            id: row.id,
            tenant_id: row.tenant_id,
            prescription_event_id: row.prescription_event_id,
            action_type: row.action_type,
            occurred_at: row.occurred_at,
            actual_start_at: row.actual_start_at,
            actual_end_at: row.actual_end_at,
            performed_by: row.performed_by,
            performed_by_user_id: row.performed_by_user_id,
            note: row.note,
            created_at: row.created_at
        };
    }

    /**
     * Get full administration history for a specific prescription event.
     */
    async getAdministrationHistory(tenantId: string, prescriptionEventId: string): Promise<AdministrationEvent[]> {
        const query = `
            SELECT * FROM administration_events
            WHERE prescription_event_id = $1
            ORDER BY occurred_at ASC
        `;
        const res = await tenantQuery<any>(tenantId, query, [prescriptionEventId]);
        return res.map((row: any) => ({
            id: row.id,
            tenant_id: row.tenant_id,
            prescription_event_id: row.prescription_event_id,
            action_type: row.action_type,
            occurred_at: row.occurred_at,
            actual_start_at: row.actual_start_at,
            actual_end_at: row.actual_end_at,
            performed_by: row.performed_by,
            performed_by_user_id: row.performed_by_user_id,
            note: row.note,
            created_at: row.created_at
        }));
    }
}

export const prescriptionService = new PrescriptionService();
