/**
 * EMR Service - PostgreSQL Version
 * Manages admissions, appointments, and rooms (tenant).
 * Patient Identity management has moved to patientGlobalService and patientTenantService.
 */

import { Admission, Appointment, Room, AdmissionMedicationConsumption } from '../models/emr';
// import { globalQuery } from '../db/globalPg'; // No longer needed
import { tenantQuery, tenantTransaction } from '../db/tenantPg';

export class EmrService {
    
    // --- ADMISSIONS (TENANT) ---

    async getAllAdmissions(tenantId: string): Promise<Admission[]> {
        // We now fetch tenant_patient_id as the primary reference
        const rows = await tenantQuery(tenantId, 'SELECT * FROM admissions', []);
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id,
            patientId: r.patient_id || '', // Legacy support or empty
            tenantPatientId: r.tenant_patient_id, // New Field
            nda: r.nda,
            reason: r.reason,
            service: r.service_id,
            admissionDate: r.admission_date,
            dischargeDate: r.discharge_date,
            doctorName: r.doctor_name,
            roomNumber: r.room_number,
            bedLabel: r.bed_label,
            status: r.status,
            currency: r.currency,
            type: undefined
        }));
    }

    async createAdmission(tenantId: string, data: Admission): Promise<Admission> {
        const newAdmission = { ...data, tenantId }; 
        // Prefer tenantPatientId, fallback to patientId if provided (legacy UI might send patientId)
        const patientIdToUse = data.tenantPatientId || data.patientId; 

        await tenantTransaction(tenantId, async (client) => {
            await client.query(`
                INSERT INTO admissions (
                    id, tenant_id, tenant_patient_id, nda, reason, service_id, 
                    admission_date, discharge_date, doctor_name, room_number, bed_label, status, currency
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                newAdmission.id, tenantId, patientIdToUse, newAdmission.nda, newAdmission.reason, newAdmission.service,
                newAdmission.admissionDate, newAdmission.dischargeDate, newAdmission.doctorName, newAdmission.roomNumber,
                newAdmission.bedLabel, newAdmission.status, newAdmission.currency
            ]);
            
            // Occupy Room
            if (newAdmission.roomNumber && newAdmission.service) {
                // Assuming 'service' in Admission maps to 'service_id' in Rooms
                await client.query(
                    'UPDATE rooms SET is_occupied = true WHERE number = $1 AND service_id = $2', 
                    [newAdmission.roomNumber, newAdmission.service]
                );
            }
        });
        
        return newAdmission;
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

            // Free Room
            if (admission.room_number && admission.service_id) {
                await client.query(
                    'UPDATE rooms SET is_occupied = false WHERE number = $1 AND service_id = $2', 
                    [admission.room_number, admission.service_id]
                );
            }
        });

        return { ...admission, status: 'Sorti', dischargeDate, service: admission.service_id };
    }

    // --- APPOINTMENTS (TENANT) ---

    async getAllAppointments(tenantId: string): Promise<Appointment[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM appointments', []);
        // TODO: Map rows to Appointment interface
        return rows as any; 
    }

    // --- ROOMS (Bridge to Settings) ---

    async getAllRooms(tenantId: string): Promise<Room[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM rooms', []);
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id, // This property might not exist on Room interface, check models/emr.ts. 
            // It has 'section'. We might need to map service_id to section or just expose service_id?
            // Room interface: id, number, section, isOccupied, patientId?, type.
            // Let's assume section was used for service name or ID previously.
            number: r.number,
            section: r.section || r.service_id, // Fallback
            isOccupied: r.is_occupied,
            type: r.type
        }));
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
            quantity: r.qty_dispensed, // changed from qty to qty_dispensed based on 022 migration
            mode: 'BOX',
            lotNumber: r.lot || '', // changed from batch_id
            batchNumber: r.lot || '',
            dispensedAt: r.dispensed_at || r.created_at,
            dispensedBy: r.dispensed_by || 'Pharmacy',
            expiryDate: r.expiry
        }));
    }
}

export const emrService = new EmrService();
