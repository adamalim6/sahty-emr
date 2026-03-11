import { getTenantPool } from '../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';
import { PatientAddiction, CreateAddictionPayload, UpdateAddictionPayload } from '../models/addictions';
import { observationsService } from './observationsService';

export class AddictionsService {
    
    async createAddiction(tenantId: string, payload: CreateAddictionPayload): Promise<PatientAddiction> {
        const pool = getTenantPool(tenantId);
        
        if (payload.addiction_type === 'OTHER' && !payload.substance_label) {
            throw new Error("substance_label must be provided when addiction_type is OTHER");
        }

        const id = uuidv4();

        const result = await pool.query(
            `INSERT INTO patient_addictions (
                id, tenant_patient_id, addiction_type, substance_label, qty, unit, frequency,
                status, stop_motivation_score, start_date, last_use_date,
                created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
            RETURNING *`,
            [
                id, payload.tenant_patient_id, payload.addiction_type, payload.substance_label || null,
                payload.qty || null, payload.unit || null, payload.frequency || null,
                payload.status, payload.stop_motivation_score || null,
                payload.start_date || null, payload.last_use_date || null,
                payload.created_by
            ]
        );

        return result.rows[0];
    }

    async updateAddiction(tenantId: string, id: string, userId: string, firstName: string, lastName: string, payload: UpdateAddictionPayload): Promise<PatientAddiction> {
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const currRes = await client.query(`SELECT * FROM patient_addictions WHERE id = $1`, [id]);
            if (currRes.rows.length === 0) throw new Error("Addiction introuvable.");
            const current = currRes.rows[0];

            const tenant_patient_id = current.tenant_patient_id;

            const trackedFields = [
                { name: 'status', type: 'text' },
                { name: 'qty', type: 'number' },
                { name: 'unit', type: 'text' },
                { name: 'frequency', type: 'text' },
                { name: 'stop_motivation_score', type: 'number' },
                { name: 'substance_label', type: 'text' },
                { name: 'start_date', type: 'text' }, // We'll store dates as text in history for simplicity
                { name: 'last_use_date', type: 'text' }
            ];

            const updates: string[] = [];
            const values: any[] = [];
            let paramNum = 1;

            for (const field of trackedFields) {
                const newValue = (payload as any)[field.name];
                
                if (newValue !== undefined && newValue !== current[field.name]) {
                    
                    if (field.name === 'status') {
                        this.validateStatusTransition(current.status, newValue);
                    }

                    updates.push(`${field.name} = $${paramNum++}`);
                    values.push(newValue);

                    // Insert History
                    const histId = uuidv4();
                    
                    let old_text = null, new_text = null, old_num = null, new_num = null;
                    
                    if (field.type === 'text') {
                        old_text = current[field.name] ? String(current[field.name]) : null;
                        new_text = newValue ? String(newValue) : null;
                    } else if (field.type === 'number') {
                        old_num = current[field.name] !== null ? Number(current[field.name]) : null;
                        new_num = newValue !== null ? Number(newValue) : null;
                    }

                    await client.query(
                        `INSERT INTO patient_addiction_history (
                            id, addiction_id, tenant_patient_id, field_name,
                            old_value_text, new_value_text, old_value_number, new_value_number,
                            changed_by, changed_by_first_name, changed_by_last_name, changed_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
                        [histId, id, tenant_patient_id, field.name, old_text, new_text, old_num, new_num, userId, firstName, lastName]
                    );
                }
            }

            if (updates.length > 0) {
                updates.push(`updated_at = now()`);
                values.push(id);

                const result = await client.query(
                    `UPDATE patient_addictions SET ${updates.join(', ')} WHERE id = $${paramNum} RETURNING *`,
                    values
                );
                await client.query('COMMIT');
                return result.rows[0];
            } else {
                await client.query('COMMIT');
                return current;
            }
            
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async updateAddictionStatus(tenantId: string, id: string, userId: string, firstName: string, lastName: string, newStatus: string): Promise<PatientAddiction> {
        return this.updateAddiction(tenantId, id, userId, firstName, lastName, { status: newStatus as any });
    }

    async listPatientAddictions(tenantId: string, tenantPatientId: string): Promise<PatientAddiction[]> {
        const pool = getTenantPool(tenantId);
        const res = await pool.query(`
            SELECT * FROM patient_addictions
            WHERE tenant_patient_id = $1
            ORDER BY created_at DESC
        `, [tenantPatientId]);
        return res.rows;
    }

    async getAddictionHistory(tenantId: string, addictionId: string): Promise<any[]> {
        const pool = getTenantPool(tenantId);
        
        const res = await pool.query(`
            SELECT *
            FROM patient_addiction_history
            WHERE addiction_id = $1
            ORDER BY changed_at DESC
        `, [addictionId]);
        
        return res.rows;
    }

    async createAddictionObservation(
        tenantId: string, 
        addictionId: string,
        userId: string, 
        authorRole: 'DOCTOR' | 'NURSE', 
        authorFirstName: string, 
        authorLastName: string, 
        payload: any
    ) {
        const pool = getTenantPool(tenantId);
        const check = await pool.query(`SELECT tenant_patient_id FROM patient_addictions WHERE id = $1`, [addictionId]);
        
        if (check.rows.length === 0) throw new Error("Addiction introuvable.");

        const tenant_patient_id = check.rows[0].tenant_patient_id;

        // Force defaults for this observation
        const obsPayload = {
            ...payload,
            tenant_patient_id,
            note_type: 'PROGRESS',
            linked_addiction_id: addictionId
        };

        return observationsService.createObservation(
            tenantId, 
            userId, 
            authorRole, 
            authorFirstName, 
            authorLastName, 
            obsPayload
        );
    }

    private validateStatusTransition(current: string, next: string) {
        if (next === 'ENTERED_IN_ERROR') return; // ANY -> ENTERED_IN_ERROR

        switch (current) {
            case 'ACTIVE':
                if (['WITHDRAWAL', 'ABSTINENT', 'RESOLVED'].includes(next)) return;
                break;
            case 'WITHDRAWAL':
                if (['ACTIVE', 'ABSTINENT'].includes(next)) return;
                break;
            case 'ABSTINENT':
                if (['ACTIVE', 'RESOLVED'].includes(next)) return;
                break;
            case 'RESOLVED':
                if (['ACTIVE'].includes(next)) return;
                break;
        }
        throw new Error(`Invalid addiction status transition from ${current} to ${next}`);
    }
}

export const addictionsService = new AddictionsService();
