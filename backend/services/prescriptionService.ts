import { Prescription, PrescriptionData, PrescriptionEvent, AdministrationEvent } from '../models/prescription';
import { patientTenantService } from './patientTenantService';
import { tenantQuery, tenantTransaction, getTenantClient } from '../db/tenantPg';
import { generateDoseSchedule } from '../utils/prescriptionScheduler';

export class PrescriptionService {
    
    // Get all prescriptions for a specific patient
    async getPrescriptionsByPatient(tenantId: string, patientId: string): Promise<Prescription[]> {
        const query = `
            SELECT
              p.*,
              cc.label as care_category_label,
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
            LEFT JOIN reference.global_dci gd 
                ON p.prescription_type = 'medication' 
                AND gd.id::text = split_part(p.details->>'moleculeId', ',', 1)
            LEFT JOIN reference.care_categories cc 
                ON cc.id = gd.care_category_id
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
                careCategory: row.care_category_label || 'Z_Autre',
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
            // Refactor Transfusion Unit Normalization
            if (pType === 'transfusion') {
                const getUnitQuery = `SELECT id FROM reference.units WHERE code = 'ml' LIMIT 1`;
                const unitRes = await client.query(getUnitQuery);
                if (unitRes.rows.length > 0) {
                    details.unit_id = unitRes.rows[0].id;
                }
                
                // Convert qty strictly to number
                if (details.qty !== undefined) {
                    details.qty = Number(details.qty);
                }
                
                // Keep the 'unit' key around for legacy code internally, or remove it entirely as instructed
                // "Ne plus stocker label dans JSON."
                delete details.unit;
            }

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
            'unit', 'unit_id', 'blood_product_type', 'route', 'qty', 'solvent',
            'adminMode', 'adminDuration',
            'substitutable', 'dilutionRequired', 'databaseMode'
        ];

        // Transfusion exception: keeps qty, unit, adminDuration, route
        const TRANSFUSION_KEEP = ['qty', 'unit_id', 'blood_product_type', 'adminDuration', 'route'];

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
                latest_admin.performed_by_user_id,
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
            performedBy: row.performed_by_user_id || undefined,
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
        eventId: string, // Enforcing explicit event ID
        action_type?: string,
        occurred_at?: string,
        actual_start_at?: string | null,
        actual_end_at?: string | null,
        status?: string, // legacy fallback
        justification?: string, 
        performedBy?: string, 
        performedByUserId?: string, // new field added for user linkage
        actualDate?: string // legacy fallback
    }): Promise<any> {

        // Enforce safety rules: block administration if PAUSED or STOPPED
        const checkPQuery = `SELECT paused_at, stopped_at FROM prescriptions WHERE id = $1`;
        const checkPRes = await tenantQuery<{paused_at: Date | null, stopped_at: Date | null}>(tenantId, checkPQuery, [execution.prescriptionId]);
        if (checkPRes.length > 0) {
            if (checkPRes[0].stopped_at) throw new Error("Cannot execute: Prescription is STOPPED.");
            if (checkPRes[0].paused_at) throw new Error("Cannot execute: Prescription is PAUSED.");
        }
        
        const eventId = execution.eventId;
        if (!eventId) {
            throw new Error("Cannot record administration: missing prescription_event_id.");
        }

        // Use action_type directly if provided, else map from legacy status
        const actionType = execution.action_type || this.mapStatusToActionType(execution.status || 'planned');
        
        // Coalesce dates
        const occurredAt = execution.occurred_at ? new Date(execution.occurred_at) : new Date();
        const actualStart = execution.actual_start_at ? new Date(execution.actual_start_at) : (execution.actualDate ? new Date(execution.actualDate) : null);
        const actualEnd = execution.actual_end_at ? new Date(execution.actual_end_at) : null;

        // Insert administration event
        const adminInsertQuery = `
            INSERT INTO administration_events (
                tenant_id, prescription_event_id, action_type, occurred_at,
                actual_start_at, actual_end_at, note, performed_by_user_id,
                status, linked_event_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NULL)
            RETURNING *
        `;
        const adminRes = await tenantQuery<any>(tenantId, adminInsertQuery, [
            tenantId,
            eventId,
            actionType,
            occurredAt,
            actualStart,
            actualEnd,
            execution.justification || null,
            execution.performedByUserId || null
        ]);

        const r = adminRes[0];
        return {
            id: r.id,
            eventId: eventId,
            prescriptionId: execution.prescriptionId,
            action_type: r.action_type,
            occurred_at: r.occurred_at,
            actual_start_at: r.actual_start_at,
            actual_end_at: r.actual_end_at,
            justification: r.note || undefined,
            performedBy: r.performed_by_user_id || undefined
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

    private async getEventById(tenantId: string, id: string): Promise<AdministrationEvent> {
        const query = `SELECT * FROM administration_events WHERE id = $1`;
        const res = await tenantQuery<AdministrationEvent>(tenantId, query, [id]);
        if (res.length === 0) throw new Error("Event not found");
        return res[0];
    }

    /**
     * NEW: Explicit administration action logging (Epic-like)
     */
    async logAdministrationAction(
        tenantId: string,
        prescriptionEventId: string,
        actionType: string,
        payload?: {
            occurredAt?: Date;
            actualStartAt?: Date;
            actualEndAt?: Date;
            performedBy?: string;
            performedByUserId?: string;
            note?: string;
            transfusion?: {
                bloodBagIds: string[];
                checks: {
                    identity_check_done: boolean;
                    compatibility_check_done: boolean;
                    bedside_double_check_done: boolean;
                    vitals_baseline_done: boolean;
                    notes?: string;
                };
                reaction?: {
                    reaction_present: boolean;
                    reaction_type?: string;
                    severity?: string;
                    description?: string;
                    actions_taken?: string;
                };
            };
            administered_bags?: { id: string, volume_ml: number }[];
            linked_event_id?: string;
        }
    ): Promise<AdministrationEvent> {
        // Enforce safety rules via join back to prescriptions
        const checkSafetyQuery = `
            SELECT p.paused_at, p.stopped_at, pe.scheduled_at 
            FROM prescriptions p
            JOIN prescription_events pe ON pe.prescription_id = p.id
            WHERE pe.id = $1
        `;
        const checkSafetyRes = await tenantQuery<{paused_at: Date | null, stopped_at: Date | null, scheduled_at: Date}>(tenantId, checkSafetyQuery, [prescriptionEventId]);
        if (checkSafetyRes.length > 0) {
            if (checkSafetyRes[0].stopped_at) throw new Error("Cannot log administration action: Prescription is STOPPED.");
            if (checkSafetyRes[0].paused_at) throw new Error("Cannot log administration action: Prescription is PAUSED.");
            
            const scheduledAt = new Date(checkSafetyRes[0].scheduled_at).getTime();
            const now = Date.now();
            const targetTime = payload?.occurredAt ? new Date(payload.occurredAt).getTime() : now;
            
            if (targetTime > now) {
                throw new Error("Administration time cannot be in the future.");
            }
            if (targetTime < scheduledAt - (48 * 60 * 60 * 1000) || targetTime > scheduledAt + (48 * 60 * 60 * 1000)) {
                throw new Error("Administration time outside allowed window.");
            }
        }

        let linkedEventId = null;
        const finalOccurredAt = payload?.occurredAt ? new Date(payload.occurredAt) : new Date();

        let internalActionType = actionType;

        // ---------------------------------------------------------
        // UNIVERSAL WIPE FOR REFUSALS AND BOLUS
        // ---------------------------------------------------------
        if (internalActionType === 'refused' || internalActionType === 'administered') {
            const findExactQuery = `
                SELECT id, occurred_at 
                FROM administration_events
                WHERE prescription_event_id = $1 
                  AND action_type = $2 
                  AND status = 'ACTIVE'
                ORDER BY occurred_at DESC
                LIMIT 1
            `;
            const exactRes = await tenantQuery<{id: string, occurred_at: Date}>(tenantId, findExactQuery, [prescriptionEventId, internalActionType]);
            if (exactRes.length > 0 && Math.abs(exactRes[0].occurred_at.getTime() - finalOccurredAt.getTime()) < 60000) {
                return this.getEventById(tenantId, exactRes[0].id);
            }

            const wipeAllQuery = `
                UPDATE administration_events
                SET status = 'CANCELLED', cancellation_reason = 'Superseded by overriding state'
                WHERE prescription_event_id = $1
                  AND status = 'ACTIVE'
            `;
            await tenantQuery(tenantId, wipeAllQuery, [prescriptionEventId]);
            linkedEventId = null;
        }

        // ---------------------------------------------------------
        // PERFUSION START RULES
        // ---------------------------------------------------------
        else if (internalActionType === 'started') {
            const wipeNonPerfusionQuery = `
                UPDATE administration_events
                SET status = 'CANCELLED', cancellation_reason = 'Superseded by perfusion start'
                WHERE prescription_event_id = $1
                  AND action_type IN ('refused', 'administered')
                  AND status = 'ACTIVE'
            `;
            await tenantQuery(tenantId, wipeNonPerfusionQuery, [prescriptionEventId]);

            const findStartQuery = `
                SELECT id, linked_event_id, occurred_at 
                FROM administration_events
                WHERE prescription_event_id = $1 
                  AND action_type = 'started' 
                  AND status = 'ACTIVE'
                ORDER BY occurred_at DESC
                LIMIT 1
            `;
            const startRes = await tenantQuery<{id: string, linked_event_id: string, occurred_at: Date}>(tenantId, findStartQuery, [prescriptionEventId]);

            if (startRes.length > 0) {
                const existing = startRes[0];
                if (Math.abs(existing.occurred_at.getTime() - finalOccurredAt.getTime()) < 60000) {
                    return this.getEventById(tenantId, existing.id);
                } else {
                    const cancelQuery = `
                        UPDATE administration_events
                        SET status = 'CANCELLED', cancellation_reason = 'Superseded by slider update'
                        WHERE linked_event_id = $1
                          AND status = 'ACTIVE'
                    `;
                    await tenantQuery(tenantId, cancelQuery, [existing.linked_event_id]);
                }
            }
            
            linkedEventId = crypto.randomUUID();
        } 
        
        // ---------------------------------------------------------
        // PERFUSION END RULES
        // ---------------------------------------------------------
        else if (internalActionType === 'ended') {
            const findEndQuery = `
                SELECT id, occurred_at
                FROM administration_events
                WHERE prescription_event_id = $1
                  AND action_type = 'PERFUSION_END'
                  AND status = 'ACTIVE'
                ORDER BY occurred_at DESC
                LIMIT 1
            `;
            const endRes = await tenantQuery<{id: string, occurred_at: Date}>(tenantId, findEndQuery, [prescriptionEventId]);
            
            if (endRes.length > 0) {
                const existing = endRes[0];
                if (Math.abs(existing.occurred_at.getTime() - finalOccurredAt.getTime()) < 60000) {
                    return this.getEventById(tenantId, existing.id);
                } else {
                    const cancelEndQuery = `
                        UPDATE administration_events
                        SET status = 'CANCELLED', cancellation_reason = 'Superseded by slider update'
                        WHERE id = $1
                    `;
                    await tenantQuery(tenantId, cancelEndQuery, [existing.id]);
                }
            }

            const findStartQuery = `
                SELECT linked_event_id 
                FROM administration_events
                WHERE prescription_event_id = $1 
                  AND action_type = 'started' 
                  AND status = 'ACTIVE'
                ORDER BY occurred_at DESC
                LIMIT 1
            `;
            const startRes = await tenantQuery<{linked_event_id: string}>(tenantId, findStartQuery, [prescriptionEventId]);
            if (startRes.length > 0 && startRes[0].linked_event_id) {
                linkedEventId = startRes[0].linked_event_id;
            } else {
                throw new Error("Cannot end perfusion: No active 'started' event found to link to.");
            }
        }



        let firstName = null;
        let lastName = null;
        if (payload?.performedByUserId) {
            const userRes = await tenantQuery<{first_name: string, last_name: string}>(
                tenantId,
                'SELECT first_name, last_name FROM auth.users WHERE user_id = $1',
                [payload.performedByUserId]
            );
            if (userRes.length > 0) {
                firstName = userRes[0].first_name;
                lastName = userRes[0].last_name;
            }
        }

        const query = `
            INSERT INTO administration_events (
                tenant_id, prescription_event_id, action_type, occurred_at,
                actual_start_at, actual_end_at, performed_by_user_id, note,
                status, linked_event_id, performed_by_first_name, performed_by_last_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, $10, $11)
            RETURNING *
        `;

        const client = await getTenantClient(tenantId);
        let row;
        try {
            await client.query('BEGIN');
            const res = await client.query(query, [
                tenantId,
                prescriptionEventId,
                internalActionType,
                finalOccurredAt,
                payload?.actualStartAt || null,
                payload?.actualEndAt || null,
                payload?.performedByUserId || null,
                payload?.note || null,
                linkedEventId,
                firstName,
                lastName
            ]);
            row = res.rows[0];

            if (payload?.transfusion && internalActionType === 'started' && payload.transfusion.bloodBagIds?.length > 0) {
                const adminEventId = row.id;

                // 1. Mark bags as IN_USE
                for (const bagId of payload.transfusion.bloodBagIds) {
                    
                    // Verify Bag Status before assignment
                    const bagRes = await client.query(`SELECT status, volume_ml, bag_number, assigned_prescription_event_id FROM public.transfusion_blood_bags WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [bagId, tenantId]);
                    if (bagRes.rows.length === 0) throw new Error(`Blood bag ${bagId} not found.`);
                    const bag = bagRes.rows[0];
                    if (bag.status === 'USED' || bag.status === 'DISCARDED') {
                        throw new Error(`Cannot administer blood bag ${bag.bag_number} because it has already been used or discarded.`);
                    }

                    // Enforce Assignment Rule
                    if (bag.assigned_prescription_event_id && bag.assigned_prescription_event_id !== prescriptionEventId) {
                        throw new Error(`Cette poche de sang a déjà été assignée à une autre session de transfusion.`);
                    }
                    if (!bag.assigned_prescription_event_id) {
                        await client.query(`
                            UPDATE public.transfusion_blood_bags 
                            SET assigned_prescription_event_id = $1 
                            WHERE id = $2 AND tenant_id = $3
                        `, [prescriptionEventId, bagId, tenantId]);
                    }

                    // Extract Admin Volume
                    const adminBag = payload.administered_bags?.find(b => b.id === bagId);
                    const adminVolume = adminBag?.volume_ml || 0;
                    
                    // Only enforce volume must be > 0 if this is NOT just a START event,
                    // or if the frontend actually provided a volume.
                    if (adminVolume <= 0 && internalActionType !== 'started') {
                        throw new Error(`Administered volume for blood bag ${bag.bag_number} must be greater than 0.`);
                    }
                    if (adminVolume > bag.volume_ml) {
                        throw new Error(`Administered volume (${adminVolume} ml) for blood bag ${bag.bag_number} exceeds the bag's total volume (${bag.volume_ml} ml).`);
                    }

                    // (Status corresponds to derived 'IN_USE', 'USED' state managed by PostgreSQL trigger recompute_blood_bag_status)

                    // 2. Insert mapping with volume
                    await client.query(`
                        INSERT INTO public.administration_event_blood_bags (
                            tenant_id, administration_event_id, blood_bag_id, volume_administered_ml
                        ) VALUES ($1, $2, $3, $4)
                    `, [tenantId, adminEventId, bagId, adminVolume]);
                }

                // 3. Insert checks
                if (payload.transfusion.checks) {
                    await client.query(`
                        INSERT INTO public.transfusion_checks (
                            tenant_id, administration_event_id, checked_by_user_id,
                            identity_check_done, compatibility_check_done, 
                            bedside_double_check_done, vitals_baseline_done, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        tenantId, adminEventId, payload.performedByUserId,
                        payload.transfusion.checks.identity_check_done,
                        payload.transfusion.checks.compatibility_check_done,
                        payload.transfusion.checks.bedside_double_check_done,
                        payload.transfusion.checks.vitals_baseline_done,
                        payload.transfusion.checks.notes || null
                    ]);
                }

                // 4. Insert reaction if present
                if (payload.transfusion.reaction && payload.transfusion.reaction.reaction_present) {
                    await client.query(`
                        INSERT INTO public.transfusion_reactions (
                            tenant_id, administration_event_id, recorded_by_user_id,
                            reaction_type, severity, description, actions_taken
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        tenantId, adminEventId, payload.performedByUserId,
                        payload.transfusion.reaction.reaction_type,
                        payload.transfusion.reaction.severity || null,
                        payload.transfusion.reaction.description || null,
                        payload.transfusion.reaction.actions_taken || null
                    ]);
                }
            }

            // PERFUSION_END: Transition IN_USE bags to USED
            if (internalActionType === 'ended') {
                const adminEventId = row.id;
                
                // Find original START event bags to mark as USED
                if (linkedEventId) {
                    await client.query(`
                        UPDATE public.transfusion_blood_bags 
                        SET status = 'USED' 
                        WHERE id IN (
                            SELECT blood_bag_id 
                            FROM public.administration_event_blood_bags 
                            WHERE administration_event_id = (
                                SELECT id FROM administration_events WHERE linked_event_id = $1 AND action_type = 'started'
                            )
                        )
                    `, [linkedEventId]);
                }

                if (payload?.transfusion?.reaction && payload.transfusion.reaction.reaction_present) {
                     await client.query(`
                        INSERT INTO public.transfusion_reactions (
                            tenant_id, administration_event_id, recorded_by_user_id,
                            reaction_type, severity, description, actions_taken
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        tenantId, adminEventId, payload.performedByUserId,
                        payload.transfusion.reaction.reaction_type,
                        payload.transfusion.reaction.severity || null,
                        payload.transfusion.reaction.description || null,
                        payload.transfusion.reaction.actions_taken || null
                    ]);
                }
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
        return {
            id: row.id,
            tenant_id: row.tenant_id,
            prescription_event_id: row.prescription_event_id,
            action_type: row.action_type,
            occurred_at: row.occurred_at,
            actual_end_at: row.actual_end_at,
            performed_by_user_id: row.performed_by_user_id,
            performed_by_first_name: row.performed_by_first_name,
            performed_by_last_name: row.performed_by_last_name,
            note: row.note,
            status: row.status,
            cancellation_reason: row.cancellation_reason,
            linked_event_id: row.linked_event_id,
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
            performed_by_user_id: row.performed_by_user_id,
            performed_by_first_name: row.performed_by_first_name,
            performed_by_last_name: row.performed_by_last_name,
            note: row.note,
            status: row.status,
            cancellation_reason: row.cancellation_reason,
            linked_event_id: row.linked_event_id,
            created_at: row.created_at
        }));
    }

    /**
     * Cancel an administration event safely.
     * Uses the flat `linked_event_id` to automatically sweep linked END events 
     * when a START event is cancelled, avoiding cyclic recursion.
     */
    async cancelAdministrationEvent(
        tenantId: string,
        adminEventId: string,
        cancellationReason?: string
    ): Promise<void> {
        
        // 1. Fetch the target event
        const getQuery = `SELECT status, action_type, linked_event_id FROM administration_events WHERE id = $1`;
        const getRes = await tenantQuery<{status: string, action_type: string, linked_event_id: string | null}>(tenantId, getQuery, [adminEventId]);
        
        if (getRes.length === 0) throw new Error("Event not found");
        const event = getRes[0];

        if (event.status === 'CANCELLED') {
            throw new Error("Event is already cancelled.");
        }

        // 2. Perform Flat Atomic Cancellation
        let cancelQuery = "";
        let params: any[] = [];

        if (event.action_type === 'PERFUSION_START' && event.linked_event_id) {
            // Cancel the START and its associated END in one atomic sweep using the flat group ID
            cancelQuery = `
                UPDATE administration_events 
                SET status = 'CANCELLED', cancellation_reason = $1
                WHERE linked_event_id = $2 AND status = 'ACTIVE'
            `;
            params = [cancellationReason || null, event.linked_event_id];
        } else {
            // Cancel a normal event OR an isolated END event
            cancelQuery = `
                UPDATE administration_events 
                SET status = 'CANCELLED', cancellation_reason = $1
                WHERE id = $2 AND status = 'ACTIVE'
            `;
            params = [cancellationReason || null, adminEventId];
        }

        const client = await getTenantClient(tenantId);
        try {
            await client.query('BEGIN');
            await client.query(cancelQuery, params);

            // 3. Revert blood bags to RECEIVED safely
            const revertBagsQuery = `
                UPDATE public.transfusion_blood_bags
                SET status = 'RECEIVED'
                WHERE id IN (
                    SELECT blood_bag_id FROM public.administration_event_blood_bags
                    WHERE administration_event_id IN (
                        SELECT id FROM public.administration_events
                        WHERE ${event.action_type === 'PERFUSION_START' && event.linked_event_id ? `linked_event_id = $1` : `id = $1`}
                    ) AND tenant_id = $2
                ) AND tenant_id = $2
            `;
            const revertTarget = (event.action_type === 'PERFUSION_START' && event.linked_event_id) ? event.linked_event_id : adminEventId;
            await client.query(revertBagsQuery, [revertTarget, tenantId]);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}

export const prescriptionService = new PrescriptionService();
