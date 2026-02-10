/**
 * EMR Service - PostgreSQL Version (Refactored)
 * Manages admissions, appointments, and medication consumption (tenant).
 * Physical placement (rooms/beds/stays) is now in placementService.ts.
 */

import { Admission, Appointment, AdmissionMedicationConsumption } from '../models/emr';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { placementService } from './placementService';

export class EmrService {
    
    // --- ADMISSIONS (TENANT) ---

    async getAllAdmissions(tenantId: string): Promise<Admission[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT a.*,
                   pt.first_name AS patient_first_name,
                   pt.last_name AS patient_last_name
            FROM admissions a
            LEFT JOIN patients_tenant pt ON pt.tenant_patient_id = a.tenant_patient_id
            ORDER BY a.admission_date DESC
        `, []);
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id,
            tenantPatientId: r.tenant_patient_id,
            admissionNumber: r.admission_number,
            reason: r.reason,
            attendingPhysicianUserId: r.attending_physician_user_id,
            admittingServiceId: r.admitting_service_id,
            responsibleServiceId: r.responsible_service_id,
            currentServiceId: r.current_service_id,
            admissionDate: r.admission_date,
            dischargeDate: r.discharge_date,
            status: r.status,
            currency: r.currency,
            // Legacy compat fields
            nda: r.admission_number,
            service: r.current_service_id,
            patientId: r.tenant_patient_id,
        }));
    }

    async createAdmission(tenantId: string, data: Partial<Admission>): Promise<Admission> {
        return await tenantTransaction(tenantId, async (client) => {
            const id = data.id || require('uuid').v4();

            // Generate admission_number: ADM-YYYY-NNNNNN
            const seqResult = await client.query(`SELECT nextval('admission_number_seq') AS seq`);
            const seq = seqResult.rows[0].seq;
            const year = new Date().getFullYear();
            const admissionNumber = data.admissionNumber || `ADM-${year}-${String(seq).padStart(6, '0')}`;

            // Resolve tenantPatientId (new way) or patientId (legacy)
            const tenantPatientId = data.tenantPatientId || data.patientId || null;

            // Resolve service IDs — use specific fields or fall back to legacy 'service'
            const admittingServiceId = data.admittingServiceId || data.service || null;
            const responsibleServiceId = data.responsibleServiceId || data.service || null;
            const currentServiceId = data.currentServiceId || data.service || null;

            await client.query(`
                INSERT INTO admissions (
                    id, tenant_id, tenant_patient_id, admission_number, reason,
                    attending_physician_user_id, admitting_service_id, responsible_service_id, current_service_id,
                    admission_date, discharge_date, status, currency
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                id, tenantId, tenantPatientId, admissionNumber, data.reason || null,
                data.attendingPhysicianUserId || null, admittingServiceId, responsibleServiceId, currentServiceId,
                data.admissionDate || new Date().toISOString(), data.dischargeDate || null,
                data.status || 'En cours', data.currency || 'MAD'
            ]);

            return {
                id,
                tenantId,
                tenantPatientId,
                admissionNumber,
                reason: data.reason || '',
                attendingPhysicianUserId: data.attendingPhysicianUserId,
                admittingServiceId,
                responsibleServiceId,
                currentServiceId,
                admissionDate: data.admissionDate || new Date().toISOString(),
                dischargeDate: data.dischargeDate,
                status: data.status || 'En cours',
                currency: data.currency || 'MAD',
                // Legacy compat
                nda: admissionNumber,
                service: currentServiceId,
                patientId: tenantPatientId,
            } as Admission;
        });
    }

    async closeAdmission(tenantId: string, id: string): Promise<Admission | null> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM admissions WHERE id = $1', [id]);
        if (rows.length === 0) return null;
        const admission = rows[0];

        const dischargeDate = new Date().toISOString();
        
        await tenantTransaction(tenantId, async (client) => {
            await client.query(
                "UPDATE admissions SET status = 'Sorti', discharge_date = $1 WHERE id = $2", 
                [dischargeDate, id]
            );

            // End any active stay and free the bed
            const activeStays = await client.query(
                `SELECT id, bed_id FROM patient_stays WHERE admission_id = $1 AND ended_at IS NULL`, [id]);
            
            for (const stay of activeStays.rows) {
                await client.query(`UPDATE patient_stays SET ended_at = $2 WHERE id = $1`, [stay.id, dischargeDate]);
                // Free the bed if no other active stays
                const otherStays = await client.query(
                    `SELECT id FROM patient_stays WHERE bed_id = $1 AND ended_at IS NULL AND id != $2 LIMIT 1`,
                    [stay.bed_id, stay.id]);
                if (otherStays.rows.length === 0) {
                    await client.query(`UPDATE beds SET status = 'AVAILABLE' WHERE id = $1`, [stay.bed_id]);
                }
            }
        });

        return {
            id: admission.id,
            tenantId: admission.tenant_id,
            tenantPatientId: admission.tenant_patient_id,
            admissionNumber: admission.admission_number,
            reason: admission.reason,
            attendingPhysicianUserId: admission.attending_physician_user_id,
            admittingServiceId: admission.admitting_service_id,
            responsibleServiceId: admission.responsible_service_id,
            currentServiceId: admission.current_service_id,
            admissionDate: admission.admission_date,
            dischargeDate: dischargeDate,
            status: 'Sorti',
            currency: admission.currency,
            nda: admission.admission_number,
            service: admission.current_service_id,
        } as Admission;
    }

    async changeCurrentService(tenantId: string, admissionId: string, serviceId: string): Promise<void> {
        await tenantQuery(tenantId,
            `UPDATE admissions SET current_service_id = $2 WHERE id = $1`, [admissionId, serviceId]);
    }

    async changeResponsibleService(tenantId: string, admissionId: string, serviceId: string): Promise<void> {
        await tenantQuery(tenantId,
            `UPDATE admissions SET responsible_service_id = $2 WHERE id = $1`, [admissionId, serviceId]);
    }

    // --- APPOINTMENTS (TENANT) ---

    async getAllAppointments(tenantId: string): Promise<Appointment[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM appointments', []);
        return rows as any; 
    }

    // --- CONSUMPTIONS (TENANT) ---
    
    async addMedicationConsumption(tenantId: string, consumption: AdmissionMedicationConsumption) {
        console.warn("EmrService: addMedicationConsumption called. Should rely on Pharmacy Dispense Events.");
    }

    async getConsumptionsByAdmission(tenantId: string, admissionId: string): Promise<AdmissionMedicationConsumption[]> {
        const rows = await tenantQuery(tenantId, 
            'SELECT * FROM medication_dispense_events WHERE admission_id = $1', 
            [admissionId]
        );
        return rows.map(r => ({
            id: r.id,
            admissionId: r.admission_id,
            productId: r.product_id,
            productName: r.product_name || 'Unknown', 
            quantity: r.qty_dispensed,
            mode: 'BOX' as const,
            lotNumber: r.lot || '',
            batchNumber: r.lot || '',
            dispensedAt: r.dispensed_at || r.created_at,
            dispensedBy: r.dispensed_by || 'Pharmacy',
            expiryDate: r.expiry
        }));
    }
}

export const emrService = new EmrService();
