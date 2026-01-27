/**
 * EMR Service - PostgreSQL Version
 * Manages patients (global), admissions, appointments, and rooms (tenant)
 */

import { Patient, Admission, Appointment, Room, Gender, AdmissionMedicationConsumption } from '../models/emr';
import { globalQuery } from '../db/globalPg';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';

export class EmrService {
    
    // --- PATIENTS (GLOBAL) ---

    async getAllPatients(): Promise<Patient[]> {
        const rows = await globalQuery('SELECT * FROM patients', []);
        return rows.map(this.mapPatient);
    }

    async getPatientById(id: string): Promise<Patient | undefined> {
        const rows = await globalQuery('SELECT * FROM patients WHERE id = $1', [id]);
        return rows.length > 0 ? this.mapPatient(rows[0]) : undefined;
    }

    async createPatient(data: Partial<Patient>): Promise<Patient> {
        const newPatient: Patient = {
            id: `PAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            isProvisional: false,
            firstName: '',
            lastName: '',
            dateOfBirth: '',
            gender: Gender.Male,
            ipp: `IPP-${Date.now()}`,
            ...data
        } as Patient;

        await globalQuery(`
            INSERT INTO patients (
                id, ipp, "firstName", "lastName", "dateOfBirth", gender, cin, phone, email, 
                address, city, country, nationality, "maritalStatus", profession, "bloodGroup", "isPayant",
                insurance_data, emergency_contacts, guardian_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        `, [
            newPatient.id, newPatient.ipp, newPatient.firstName, newPatient.lastName, newPatient.dateOfBirth, newPatient.gender, 
            newPatient.cin, newPatient.phone, newPatient.email, newPatient.address, newPatient.city, newPatient.country,
            newPatient.nationality, newPatient.maritalStatus, newPatient.profession, newPatient.bloodGroup, newPatient.isPayant,
            JSON.stringify(newPatient.insurance || {}),
            JSON.stringify(newPatient.emergencyContacts || []),
            JSON.stringify(newPatient.guardian || {})
        ]);

        return newPatient;
    }

    async updatePatient(id: string, data: Partial<Patient>): Promise<Patient | null> {
        const existing = await this.getPatientById(id);
        if (!existing) return null;

        const updated = { ...existing, ...data };
        
        await globalQuery(`
            UPDATE patients SET 
                ipp=$1, "firstName"=$2, "lastName"=$3, "dateOfBirth"=$4, gender=$5, cin=$6, phone=$7, email=$8, 
                address=$9, city=$10, country=$11, nationality=$12, "maritalStatus"=$13, profession=$14, "bloodGroup"=$15, "isPayant"=$16,
                insurance_data=$17, emergency_contacts=$18, guardian_data=$19
            WHERE id=$20
        `, [
            updated.ipp, updated.firstName, updated.lastName, updated.dateOfBirth, updated.gender, 
            updated.cin, updated.phone, updated.email, updated.address, updated.city, updated.country,
            updated.nationality, updated.maritalStatus, updated.profession, updated.bloodGroup, updated.isPayant,
            JSON.stringify(updated.insurance || {}),
            JSON.stringify(updated.emergencyContacts || []),
            JSON.stringify(updated.guardian || {}),
            updated.id
        ]);

        return updated;
    }
    
    private mapPatient(row: any): Patient {
        return {
            id: row.id,
            ipp: row.ipp,
            firstName: row.firstName || row.firstname,
            lastName: row.lastName || row.lastname,
            dateOfBirth: row.dateOfBirth || row.dateofbirth,
            gender: row.gender,
            cin: row.cin,
            phone: row.phone,
            email: row.email,
            address: row.address,
            city: row.city,
            country: row.country,
            nationality: row.nationality,
            maritalStatus: row.maritalStatus || row.maritalstatus,
            profession: row.profession,
            bloodGroup: row.bloodGroup || row.bloodgroup,
            isPayant: row.isPayant || row.ispayant,
            insurance: row.insurance_data ? (typeof row.insurance_data === 'string' ? JSON.parse(row.insurance_data) : row.insurance_data) : undefined,
            emergencyContacts: row.emergency_contacts ? (typeof row.emergency_contacts === 'string' ? JSON.parse(row.emergency_contacts) : row.emergency_contacts) : [],
            guardian: row.guardian_data ? (typeof row.guardian_data === 'string' ? JSON.parse(row.guardian_data) : row.guardian_data) : undefined,
            isProvisional: false
        };
    }

    // --- ADMISSIONS (TENANT) ---

    async getAllAdmissions(tenantId: string): Promise<Admission[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM admissions', []);
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id,
            patientId: r.patient_id,
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
        
        await tenantTransaction(tenantId, async (client) => {
            await client.query(`
                INSERT INTO admissions (id, tenant_id, patient_id, nda, reason, service_id, admission_date, discharge_date, doctor_name, room_number, bed_label, status, currency)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                newAdmission.id, tenantId, newAdmission.patientId, newAdmission.nda, newAdmission.reason, newAdmission.service,
                newAdmission.admissionDate, newAdmission.dischargeDate, newAdmission.doctorName, newAdmission.roomNumber,
                newAdmission.bedLabel, newAdmission.status, newAdmission.currency
            ]);
            
            // Occupy Room
            if (newAdmission.roomNumber) {
                await client.query(
                    'UPDATE rooms SET is_occupied = true WHERE number = $1 AND section = $2', 
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
            if (admission.room_number) {
                await client.query(
                    'UPDATE rooms SET is_occupied = false WHERE number = $1 AND section = $2', 
                    [admission.room_number, admission.service_id]
                );
            }
        });

        return { ...admission, status: 'Sorti', dischargeDate, service: admission.service_id };
    }

    // --- APPOINTMENTS (TENANT) ---

    async getAllAppointments(tenantId: string): Promise<Appointment[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM appointments', []);
        return rows as any; // Todo Mapping
    }

    // --- ROOMS (Bridge to Settings) ---

    async getAllRooms(tenantId: string): Promise<Room[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM rooms', []);
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id,
            number: r.number,
            section: r.section,
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
            'SELECT * FROM dispense_events WHERE admission_id = $1', 
            [admissionId]
        );
        return rows.map(r => ({
            id: r.id,
            admissionId: r.admission_id,
            productId: r.product_id,
            productName: r.product_name || 'Unknown', 
            quantity: r.qty,
            mode: 'BOX',
            lotNumber: r.batch_id || '',
            batchNumber: r.batch_id || '',
            dispensedAt: r.created_at,
            dispensedBy: r.user_id || 'Pharmacy',
            expiryDate: undefined
        }));
    }
}

export const emrService = new EmrService();
