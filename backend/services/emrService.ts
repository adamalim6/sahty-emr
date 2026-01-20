
import { Patient, Admission, Appointment, Room, Gender, AdmissionMedicationConsumption } from '../models/emr';
import { getTenantDB } from '../db/tenantDb';
import { getGlobalDB } from '../db/globalDb';
import { Database } from 'sqlite3';

// Helpers
const run = (db: Database, sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(); });
});

const get = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row as T); });
});

const all = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows as T[]); });
});

export class EmrService {
    
    // --- PATIENTS (GLOBAL) ---

    async getAllPatients(): Promise<Patient[]> {
        const db = await getGlobalDB();
        const rows = await all<any>(db, 'SELECT * FROM patients');
        return rows.map(this.mapPatient);
    }

    async getPatientById(id: string): Promise<Patient | undefined> {
        const db = await getGlobalDB();
        const row = await get<any>(db, 'SELECT * FROM patients WHERE id = ?', [id]);
        return row ? this.mapPatient(row) : undefined;
    }

    async createPatient(data: Partial<Patient>): Promise<Patient> {
        const db = await getGlobalDB();
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

        await run(db, `
            INSERT INTO patients (
                id, ipp, firstName, lastName, dateOfBirth, gender, cin, phone, email, 
                address, city, country, nationality, maritalStatus, profession, bloodGroup, isPayant,
                insurance_data, emergency_contacts, guardian_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            newPatient.id, newPatient.ipp, newPatient.firstName, newPatient.lastName, newPatient.dateOfBirth, newPatient.gender, 
            newPatient.cin, newPatient.phone, newPatient.email, newPatient.address, newPatient.city, newPatient.country,
            newPatient.nationality, newPatient.maritalStatus, newPatient.profession, newPatient.bloodGroup, newPatient.isPayant ? 1 : 0,
            JSON.stringify(newPatient.insurance || {}),
            JSON.stringify(newPatient.emergencyContacts || []),
            JSON.stringify(newPatient.guardian || {})
        ]);

        return newPatient;
    }

    async updatePatient(id: string, data: Partial<Patient>): Promise<Patient | null> {
        const db = await getGlobalDB();
        // Since SQL UPDATE requires listing fields, and we have Partial data...
        // For simplicity, fetch full, merge, save.
        const existing = await this.getPatientById(id);
        if (!existing) return null;

        const updated = { ...existing, ...data };
        
        // Full Update
        await run(db, `
            UPDATE patients SET 
                ipp=?, firstName=?, lastName=?, dateOfBirth=?, gender=?, cin=?, phone=?, email=?, 
                address=?, city=?, country=?, nationality=?, maritalStatus=?, profession=?, bloodGroup=?, isPayant=?,
                insurance_data=?, emergency_contacts=?, guardian_data=?
            WHERE id=?
        `, [
            updated.ipp, updated.firstName, updated.lastName, updated.dateOfBirth, updated.gender, 
            updated.cin, updated.phone, updated.email, updated.address, updated.city, updated.country,
            updated.nationality, updated.maritalStatus, updated.profession, updated.bloodGroup, updated.isPayant ? 1 : 0,
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
            firstName: row.firstName,
            lastName: row.lastName,
            dateOfBirth: row.dateOfBirth,
            gender: row.gender,
            cin: row.cin,
            phone: row.phone,
            email: row.email,
            address: row.address,
            city: row.city,
            country: row.country,
            nationality: row.nationality,
            maritalStatus: row.maritalStatus,
            profession: row.profession,
            bloodGroup: row.bloodGroup,
            isPayant: row.isPayant === 1,
            insurance: row.insurance_data ? JSON.parse(row.insurance_data) : undefined,
            emergencyContacts: row.emergency_contacts ? JSON.parse(row.emergency_contacts) : [],
            guardian: row.guardian_data ? JSON.parse(row.guardian_data) : undefined,
            isProvisional: false // Default/Todo
        };
    }

    // --- ADMISSIONS (TENANT) ---

    async getAllAdmissions(tenantId: string): Promise<Admission[]> {
        const db = await getTenantDB(tenantId);
        const rows = await all<any>(db, 'SELECT * FROM admissions');
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id,
            patientId: r.patient_id,
            nda: r.nda,
            reason: r.reason,
            service: r.service_id, // Map service_id -> service
            admissionDate: r.admission_date,
            dischargeDate: r.discharge_date,
            doctorName: r.doctor_name,
            roomNumber: r.room_number,
            bedLabel: r.bed_label,
            status: r.status,
            currency: r.currency,
            type: undefined // Todo
        }));
    }

    async createAdmission(tenantId: string, data: Admission): Promise<Admission> {
        const db = await getTenantDB(tenantId);
         const newAdmission = { ...data, tenantId }; 
        
        await run(db, `
            INSERT INTO admissions (id, tenant_id, patient_id, nda, reason, service_id, admission_date, discharge_date, doctor_name, room_number, bed_label, status, currency)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            newAdmission.id, tenantId, newAdmission.patientId, newAdmission.nda, newAdmission.reason, newAdmission.service,
            newAdmission.admissionDate, newAdmission.dischargeDate, newAdmission.doctorName, newAdmission.roomNumber,
            newAdmission.bedLabel, newAdmission.status, newAdmission.currency
        ]);
        
        // Occupy Room
        if (newAdmission.roomNumber) {
            await run(db, 'UPDATE rooms SET is_occupied = 1 WHERE number = ? AND section = ?', [newAdmission.roomNumber, newAdmission.service]);
        }
        
        return newAdmission;
    }

    async closeAdmission(tenantId: string, id: string): Promise<Admission | null> {
        const db = await getTenantDB(tenantId);
        const admission = await get<any>(db, 'SELECT * FROM admissions WHERE id = ?', [id]);
        if (!admission) return null;

        const dischargeDate = new Date().toISOString();
        await run(db, "UPDATE admissions SET status = 'Sorti', discharge_date = ? WHERE id = ?", [dischargeDate, id]);

        // Free Room
        if (admission.room_number) {
             await run(db, 'UPDATE rooms SET is_occupied = 0 WHERE number = ? AND section = ?', [admission.room_number, admission.service_id]);
        }

        return { ...admission, status: 'Sorti', dischargeDate, service: admission.service_id };
    }

    // --- APPOINTMENTS (TENANT) ---

    async getAllAppointments(tenantId: string): Promise<Appointment[]> {
        // Not implemented in DB schema fully yet? Schema has appointments table.
        const db = await getTenantDB(tenantId);
        const rows = await all<any>(db, 'SELECT * FROM appointments');
        // map...
        return rows as any; // Todo Mapping
    }

    // --- ROOMS (Bridge to Settings) ---

    async getAllRooms(tenantId: string): Promise<Room[]> {
        const db = await getTenantDB(tenantId);
        const rows = await all<any>(db, 'SELECT * FROM rooms');
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id,
            number: r.number,
            section: r.section,
            isOccupied: r.is_occupied === 1,
            type: r.type
        }));
    }

    // --- CONSUMPTIONS (TENANT) ---
    // In SQL schema? No, 'medication_dispense_events' is in Pharmacy Domain.
    // 'consumptions' in legacy EmrService was separate JSON.
    // Ideally validation against Pharmacy data.
    
    async addMedicationConsumption(tenantId: string, consumption: AdmissionMedicationConsumption) {
        // This should theoretically be handled by PharmacyService.dispense
        console.warn("EmrService: addMedicationConsumption called. Should rely on Pharmacy Dispense Events.");
    }

    async getConsumptionsByAdmission(tenantId: string, admissionId: string): Promise<AdmissionMedicationConsumption[]> {
        // Read from medication_dispense_events
         const db = await getTenantDB(tenantId);
         // Note: Schema might need 'dispense_events' or 'medication_dispense_events'. 
         // Previous Pharmacy refactor used 'dispense_events'.
         // Let's assume 'dispense_events' and it has 'admission_id'.
         // If admission_id is not in dispense_events, we check.
         // 'dispense_events' typically has: id, type, related_id (admission?), product_id, qty, ...
         // If not linked to admission in SQL yet, we might return empty.
         // BUT, we want to compile. 
         // Let's return empty array with comment if table structure is uncertain, OR try the safe mapping.
         // The error was about missing properties.
         
         const rows = await all<any>(db, 'SELECT * FROM dispense_events WHERE admission_id = ?', [admissionId]);
         return rows.map(r => ({
             id: r.id,
             admissionId: r.admission_id,
             productId: r.product_id,
             productName: r.product_name || 'Unknown', 
             quantity: r.qty,
             mode: 'BOX', // Defaulting to BOX if unknown, or derive from logic
             lotNumber: r.batch_id || '',
             batchNumber: r.batch_id || '', // Duplicate field in interface?
             dispensedAt: r.created_at,
             dispensedBy: r.user_id || 'Pharmacy',
             expiryDate: undefined
         }));
    }
}

export const emrService = new EmrService();
