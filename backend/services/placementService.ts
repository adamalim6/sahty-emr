/**
 * Placement Service — Rooms, Beds, and Patient Stays
 * Manages the physical placement domain: room types, rooms, beds, and patient stay lifecycle.
 */

import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { Room, Bed, BedStatus, PatientStay } from '../models/emr';
import { v4 as uuidv4 } from 'uuid';

export class PlacementService {

    // =========================================================================
    // ROOMS
    // =========================================================================

    async getRoomsByService(tenantId: string, serviceId: string): Promise<Room[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT r.*, rt.name AS room_type_name
            FROM rooms r
            JOIN room_types rt ON rt.id = r.room_type_id
            WHERE r.service_id = $1 AND r.is_active = true
            ORDER BY r.name
        `, [serviceId]);
        return rows.map(this.mapRoom);
    }

    async getAllRooms(tenantId: string): Promise<Room[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT r.*, rt.name AS room_type_name
            FROM rooms r
            JOIN room_types rt ON rt.id = r.room_type_id
            WHERE r.is_active = true
            ORDER BY r.name
        `);
        return rows.map(this.mapRoom);
    }

    async createRoom(tenantId: string, data: { serviceId: string; roomTypeId: string; name: string; description?: string }): Promise<Room> {
        const id = uuidv4();
        await tenantQuery(tenantId, `
            INSERT INTO rooms (id, service_id, room_type_id, name, description)
            VALUES ($1, $2, $3, $4, $5)
        `, [id, data.serviceId, data.roomTypeId, data.name, data.description || null]);

        const rows = await tenantQuery(tenantId, `
            SELECT r.*, rt.name AS room_type_name
            FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id
            WHERE r.id = $1
        `, [id]);
        return this.mapRoom(rows[0]);
    }

    async updateRoom(tenantId: string, id: string, data: { name?: string; description?: string; roomTypeId?: string }): Promise<Room> {
        await tenantQuery(tenantId, `
            UPDATE rooms SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                room_type_id = COALESCE($4, room_type_id)
            WHERE id = $1 AND is_active = true
        `, [id, data.name || null, data.description || null, data.roomTypeId || null]);

        const rows = await tenantQuery(tenantId, `
            SELECT r.*, rt.name AS room_type_name
            FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id
            WHERE r.id = $1
        `, [id]);
        return this.mapRoom(rows[0]);
    }

    async deactivateRoom(tenantId: string, id: string): Promise<void> {
        // Guard: no active stays in any bed of this room
        const activeStays = await tenantQuery(tenantId, `
            SELECT ps.id FROM patient_stays ps
            JOIN beds b ON b.id = ps.bed_id
            WHERE b.room_id = $1 AND ps.ended_at IS NULL
            LIMIT 1
        `, [id]);
        if (activeStays.length > 0) {
            throw new Error('Cannot deactivate room with active patient stays');
        }
        await tenantQuery(tenantId, `UPDATE rooms SET is_active = false WHERE id = $1`, [id]);
        // Also deactivate all beds in this room
        await tenantQuery(tenantId, `UPDATE beds SET status = 'INACTIVE' WHERE room_id = $1`, [id]);
    }

    private mapRoom(r: any): Room {
        return {
            id: r.id,
            serviceId: r.service_id,
            roomTypeId: r.room_type_id,
            name: r.name,
            description: r.description,
            isActive: r.is_active,
            createdAt: r.created_at,
            roomTypeName: r.room_type_name,
        };
    }

    // =========================================================================
    // BEDS
    // =========================================================================

    async getBedsByRoom(tenantId: string, roomId: string): Promise<Bed[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT b.*, r.name AS room_name
            FROM beds b
            JOIN rooms r ON r.id = b.room_id
            WHERE b.room_id = $1 AND b.status != 'INACTIVE'
            ORDER BY b.label
        `, [roomId]);
        return rows.map(this.mapBed);
    }

    async createBed(tenantId: string, data: { roomId: string; label: string }): Promise<Bed> {
        const id = uuidv4();
        await tenantQuery(tenantId, `
            INSERT INTO beds (id, room_id, label)
            VALUES ($1, $2, $3)
        `, [id, data.roomId, data.label]);

        const rows = await tenantQuery(tenantId, `
            SELECT b.*, r.name AS room_name FROM beds b
            JOIN rooms r ON r.id = b.room_id WHERE b.id = $1
        `, [id]);
        return this.mapBed(rows[0]);
    }

    async updateBedStatus(tenantId: string, bedId: string, status: BedStatus): Promise<Bed> {
        // Guard: can't manually set AVAILABLE if there's an active stay
        if (status === 'AVAILABLE') {
            const activeStay = await tenantQuery(tenantId,
                `SELECT id FROM patient_stays WHERE bed_id = $1 AND ended_at IS NULL LIMIT 1`, [bedId]);
            if (activeStay.length > 0) {
                throw new Error('Cannot set bed to AVAILABLE while there is an active stay');
            }
        }
        // Guard: can't set MAINTENANCE if occupied
        if (status === 'MAINTENANCE') {
            const activeStay = await tenantQuery(tenantId,
                `SELECT id FROM patient_stays WHERE bed_id = $1 AND ended_at IS NULL LIMIT 1`, [bedId]);
            if (activeStay.length > 0) {
                throw new Error('Cannot set bed to MAINTENANCE while there is an active stay');
            }
        }

        await tenantQuery(tenantId, `UPDATE beds SET status = $2 WHERE id = $1`, [bedId, status]);
        const rows = await tenantQuery(tenantId, `
            SELECT b.*, r.name AS room_name FROM beds b
            JOIN rooms r ON r.id = b.room_id WHERE b.id = $1
        `, [bedId]);
        return this.mapBed(rows[0]);
    }

    async deactivateBed(tenantId: string, bedId: string): Promise<void> {
        const activeStay = await tenantQuery(tenantId,
            `SELECT id FROM patient_stays WHERE bed_id = $1 AND ended_at IS NULL LIMIT 1`, [bedId]);
        if (activeStay.length > 0) {
            throw new Error('Cannot deactivate bed with an active stay');
        }
        await tenantQuery(tenantId, `UPDATE beds SET status = 'INACTIVE' WHERE id = $1`, [bedId]);
    }

    private mapBed(r: any): Bed {
        return {
            id: r.id,
            roomId: r.room_id,
            label: r.label,
            status: r.status,
            createdAt: r.created_at,
            roomName: r.room_name,
        };
    }

    // =========================================================================
    // PATIENT STAYS (append-only)
    // =========================================================================

    async assignInitialBed(tenantId: string, admissionId: string, tenantPatientId: string, bedId: string): Promise<PatientStay> {
        return await tenantTransaction(tenantId, async (client) => {
            // Guard: no other active stay for this admission
            const existing = await client.query(
                `SELECT id FROM patient_stays WHERE admission_id = $1 AND ended_at IS NULL LIMIT 1`, [admissionId]);
            if (existing.rows.length > 0) {
                throw new Error('Admission already has an active stay — use transferBed instead');
            }

            // Guard: bed not occupied
            const bedCheck = await client.query(
                `SELECT status FROM beds WHERE id = $1 AND status != 'INACTIVE'`, [bedId]);
            if (bedCheck.rows.length === 0) throw new Error('Bed not found or inactive');
            if (bedCheck.rows[0].status === 'OCCUPIED') throw new Error('Bed is already occupied');
            if (bedCheck.rows[0].status === 'MAINTENANCE') throw new Error('Bed is under maintenance');

            const stayId = uuidv4();
            await client.query(`
                INSERT INTO patient_stays (id, admission_id, tenant_patient_id, bed_id)
                VALUES ($1, $2, $3, $4)
            `, [stayId, admissionId, tenantPatientId, bedId]);

            await client.query(`UPDATE beds SET status = 'OCCUPIED' WHERE id = $1`, [bedId]);

            const result = await client.query(`
                SELECT ps.*, b.label AS bed_label, r.name AS room_name, s.name AS service_name
                FROM patient_stays ps
                JOIN beds b ON b.id = ps.bed_id
                JOIN rooms r ON r.id = b.room_id
                JOIN services s ON s.id = r.service_id
                WHERE ps.id = $1
            `, [stayId]);
            return this.mapStay(result.rows[0]);
        });
    }

    async transferBed(tenantId: string, admissionId: string, toBedId: string): Promise<PatientStay> {
        return await tenantTransaction(tenantId, async (client) => {
            // Find current active stay
            const currentResult = await client.query(
                `SELECT id, bed_id FROM patient_stays WHERE admission_id = $1 AND ended_at IS NULL`, [admissionId]);
            if (currentResult.rows.length === 0) {
                throw new Error('No active stay to transfer from — use assignInitialBed first');
            }
            const currentStay = currentResult.rows[0];
            const fromBedId = currentStay.bed_id;

            if (fromBedId === toBedId) throw new Error('Cannot transfer to the same bed');

            // Guard: target bed available
            const targetBed = await client.query(
                `SELECT status FROM beds WHERE id = $1 AND status != 'INACTIVE'`, [toBedId]);
            if (targetBed.rows.length === 0) throw new Error('Target bed not found or inactive');
            if (targetBed.rows[0].status === 'OCCUPIED') throw new Error('Target bed is already occupied');
            if (targetBed.rows[0].status === 'MAINTENANCE') throw new Error('Target bed is under maintenance');

            const now = new Date().toISOString();

            // End current stay
            await client.query(`UPDATE patient_stays SET ended_at = $2 WHERE id = $1`, [currentStay.id, now]);

            // Free old bed (only if no other active stays)
            const otherStays = await client.query(
                `SELECT id FROM patient_stays WHERE bed_id = $1 AND ended_at IS NULL AND id != $2 LIMIT 1`,
                [fromBedId, currentStay.id]);
            if (otherStays.rows.length === 0) {
                await client.query(`UPDATE beds SET status = 'AVAILABLE' WHERE id = $1`, [fromBedId]);
            }

            // Create new stay
            const newStayId = uuidv4();
            const admResult = await client.query(`SELECT tenant_patient_id FROM admissions WHERE id = $1`, [admissionId]);
            const tenantPatientId = admResult.rows[0].tenant_patient_id;

            await client.query(`
                INSERT INTO patient_stays (id, admission_id, tenant_patient_id, bed_id, started_at)
                VALUES ($1, $2, $3, $4, $5)
            `, [newStayId, admissionId, tenantPatientId, toBedId, now]);

            // Set target bed OCCUPIED
            await client.query(`UPDATE beds SET status = 'OCCUPIED' WHERE id = $1`, [toBedId]);

            const result = await client.query(`
                SELECT ps.*, b.label AS bed_label, r.name AS room_name, s.name AS service_name
                FROM patient_stays ps
                JOIN beds b ON b.id = ps.bed_id
                JOIN rooms r ON r.id = b.room_id
                JOIN services s ON s.id = r.service_id
                WHERE ps.id = $1
            `, [newStayId]);
            return this.mapStay(result.rows[0]);
        });
    }

    async getStaysByAdmission(tenantId: string, admissionId: string): Promise<PatientStay[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT ps.*, b.label AS bed_label, r.name AS room_name, s.name AS service_name
            FROM patient_stays ps
            JOIN beds b ON b.id = ps.bed_id
            JOIN rooms r ON r.id = b.room_id
            JOIN services s ON s.id = r.service_id
            WHERE ps.admission_id = $1
            ORDER BY ps.started_at
        `, [admissionId]);
        return rows.map(this.mapStay);
    }

    async getActiveBedOccupancy(tenantId: string, serviceId: string): Promise<any[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT b.id AS bed_id, b.label AS bed_label, b.status,
                   r.id AS room_id, r.name AS room_name,
                   ps.id AS stay_id, ps.admission_id, ps.tenant_patient_id, ps.started_at,
                   pt.first_name, pt.last_name
            FROM beds b
            JOIN rooms r ON r.id = b.room_id
            LEFT JOIN patient_stays ps ON ps.bed_id = b.id AND ps.ended_at IS NULL
            LEFT JOIN patients_tenant pt ON pt.tenant_patient_id = ps.tenant_patient_id
            WHERE r.service_id = $1 AND r.is_active = true AND b.status != 'INACTIVE'
            ORDER BY r.name, b.label
        `, [serviceId]);
        return rows;
    }

    private mapStay(r: any): PatientStay {
        return {
            id: r.id,
            admissionId: r.admission_id,
            tenantPatientId: r.tenant_patient_id,
            bedId: r.bed_id,
            startedAt: r.started_at,
            endedAt: r.ended_at,
            createdAt: r.created_at,
            bedLabel: r.bed_label,
            roomName: r.room_name,
            serviceName: r.service_name,
        };
    }
}

export const placementService = new PlacementService();
