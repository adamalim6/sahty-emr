import { Pool, PoolClient } from 'pg';
import { getTenantPool } from '../db/tenantPg';
import { CreateAllergyPayload, PatientAllergy, PatientAllergyHistory, PatientAllergyManifestation, UpdateAllergyPayload } from '../models/allergies';

export const allergiesService = {
    async getPatientAllergies(tenantId: string, tenantPatientId: string, filter: 'active' | 'all' = 'active'): Promise<PatientAllergy[]> {
        const pool: Pool = getTenantPool(tenantId);
        let query = `
            SELECT 
                a.*,
                (
                    SELECT json_agg(m.manifestation_code)
                    FROM patient_allergy_manifestations m
                    WHERE m.patient_allergy_id = a.id
                ) as manifestations
            FROM patient_allergies a
            WHERE a.tenant_patient_id = $1
        `;
        
        let params: any[] = [tenantPatientId];
        
        if (filter === 'active') {
            query += ` AND a.status = 'ACTIVE'`;
        } else {
            query += ` AND a.status != 'ENTERED_IN_ERROR'`;
        }
        
        query += ` ORDER BY a.created_at DESC`;
        
        const res = await pool.query(query, params);
        
        return res.rows.map(row => ({
            ...row,
            manifestations: row.manifestations || []
        }));
    },

    async createAllergy(tenantId: string, tenantPatientId: string, payload: CreateAllergyPayload, createdBy: string | null, firstName: string | null = null, lastName: string | null = null): Promise<PatientAllergy> {
        const pool: Pool = getTenantPool(tenantId);
        const client: PoolClient = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Check for duplicates
            const dupCheck = await client.query(`
                SELECT id FROM patient_allergies 
                WHERE tenant_patient_id = $1 
                AND allergen_dci_id = $2 
                AND status != 'ENTERED_IN_ERROR'
            `, [tenantPatientId, payload.allergen_dci_id]);
            
            if (dupCheck.rows.length > 0) {
                throw new Error('Une allergie active ou résolue existe déjà pour cet allergène.');
            }

            // 2. Fetch DCI Name snapshot from global
            // Need to connect to global pool for reference data usually, 
            // but we can query reference.global_dci directly if it's mirrored locally,
            // or we use cross-db query if it's not mirrored.
            // Let's assume reference.global_dci is mirrored locally per Sahty architecture notes.
            const dciRes = await client.query(`SELECT name FROM reference.global_dci WHERE id = $1`, [payload.allergen_dci_id]);
            if (dciRes.rows.length === 0) {
                throw new Error('Allergène DCI introuvable.');
            }
            const allergenNameSnapshot = dciRes.rows[0].name;

            // 3. Insert Patient Allergy
            const insertAllergyRes = await client.query(`
                INSERT INTO patient_allergies (
                    tenant_id, tenant_patient_id, allergen_dci_id, allergen_name_snapshot, 
                    allergy_type, severity, reaction_description, declared_at, status, created_by, updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                tenantId, tenantPatientId, payload.allergen_dci_id, allergenNameSnapshot,
                payload.allergy_type, payload.severity, payload.reaction_description || null, 
                payload.declared_at || null, payload.status, createdBy, createdBy
            ]);
            
            const newAllergy = insertAllergyRes.rows[0];

            // 4. Insert Manifestations
            if (payload.manifestations && payload.manifestations.length > 0) {
                for (const m of payload.manifestations) {
                    await client.query(`
                        INSERT INTO patient_allergy_manifestations (tenant_id, patient_allergy_id, manifestation_code, created_by)
                        VALUES ($1, $2, $3, $4)
                    `, [tenantId, newAllergy.id, m, createdBy]);
                }
            }

            // 5. Insert History Event
            await client.query(`
                INSERT INTO patient_allergy_history (
                    tenant_id, tenant_patient_id, patient_allergy_id, event_type, created_by, created_by_first_name, created_by_last_name
                ) VALUES ($1, $2, $3, 'CREATED', $4, $5, $6)
            `, [tenantId, tenantPatientId, newAllergy.id, createdBy, firstName, lastName]);

            await client.query('COMMIT');
            
            return {
                ...newAllergy,
                manifestations: payload.manifestations || []
            };

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async updateAllergyDetails(tenantId: string, allergyId: string, payload: UpdateAllergyPayload, updatedBy: string | null, firstName: string | null = null, lastName: string | null = null): Promise<PatientAllergy> {
        const pool: Pool = getTenantPool(tenantId);
        const client: PoolClient = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const currentRes = await client.query(`SELECT * FROM patient_allergies WHERE id = $1 AND tenant_id = $2`, [allergyId, tenantId]);
            if (currentRes.rows.length === 0) throw new Error('Allergie introuvable');
            
            const currentRecord = currentRes.rows[0];
            
            if (currentRecord.status === 'ENTERED_IN_ERROR') {
                throw new Error('Impossible de modifier une allergie marquée comme erreur de saisie.');
            }

            // Track changes for history
            const changes: any[] = [];
            
            if (currentRecord.severity !== payload.severity) {
                changes.push({ field: 'severity', old: currentRecord.severity, new: payload.severity });
            }
            if (currentRecord.reaction_description !== (payload.reaction_description || null)) {
                changes.push({ field: 'reaction_description', old: currentRecord.reaction_description, new: payload.reaction_description });
            }
            // Normalize dates to YYYY-MM-DD for comparison
            const currentDeclaredAt = currentRecord.declared_at 
                ? new Date(currentRecord.declared_at).toISOString().split('T')[0] 
                : null;
            const payloadDeclaredAt = payload.declared_at || null;

            if (currentDeclaredAt !== payloadDeclaredAt) {
                // simple string compare might be problematic with dates, but doing our best
                changes.push({ field: 'declared_at', old: currentDeclaredAt, new: payloadDeclaredAt });
            }

            // Update core table
            const updateRes = await client.query(`
                UPDATE patient_allergies 
                SET severity = $1, reaction_description = $2, declared_at = $3, updated_at = now(), updated_by = $4
                WHERE id = $5
                RETURNING *
            `, [
                payload.severity, 
                payload.reaction_description || null, 
                payload.declared_at || null, 
                updatedBy, 
                allergyId
            ]);
            
            const updatedAllergy = updateRes.rows[0];

            // Manifestations drift detection
            const currentManifRes = await client.query(`SELECT manifestation_code FROM patient_allergy_manifestations WHERE patient_allergy_id = $1`, [allergyId]);
            const currentManifestations = currentManifRes.rows.map(r => r.manifestation_code).sort();
            const newManifestations = (payload.manifestations || []).sort();
            
            const manifsChanged = JSON.stringify(currentManifestations) !== JSON.stringify(newManifestations);
            
            if (manifsChanged) {
                changes.push({ field: 'manifestations', old: currentManifestations.join(', '), new: newManifestations.join(', ') });
                
                await client.query(`DELETE FROM patient_allergy_manifestations WHERE patient_allergy_id = $1`, [allergyId]);
                
                for (const m of newManifestations) {
                    await client.query(`
                        INSERT INTO patient_allergy_manifestations (tenant_id, patient_allergy_id, manifestation_code, created_by)
                        VALUES ($1, $2, $3, $4)
                    `, [tenantId, allergyId, m, updatedBy]);
                }
            }

            // Log history if anything changed
            for (const change of changes) {
                await client.query(`
                    INSERT INTO patient_allergy_history (
                        tenant_id, tenant_patient_id, patient_allergy_id, event_type, 
                        changed_field, old_value, new_value, created_by, created_by_first_name, created_by_last_name
                    ) VALUES ($1, $2, $3, 'DETAILS_UPDATED', $4, $5, $6, $7, $8, $9)
                `, [
                    tenantId, currentRecord.tenant_patient_id, allergyId, 
                    change.field, change.old, change.new, updatedBy, firstName, lastName
                ]);
            }

            await client.query('COMMIT');
            
            return {
                ...updatedAllergy,
                manifestations: newManifestations
            };

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async changeAllergyStatus(tenantId: string, allergyId: string, newStatus: 'ACTIVE' | 'RESOLVED' | 'ENTERED_IN_ERROR', updatedBy: string | null, firstName: string | null = null, lastName: string | null = null): Promise<void> {
        const pool: Pool = getTenantPool(tenantId);
        const client: PoolClient = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const currentRes = await client.query(`SELECT status, tenant_patient_id FROM patient_allergies WHERE id = $1 AND tenant_id = $2`, [allergyId, tenantId]);
            if (currentRes.rows.length === 0) throw new Error('Allergie introuvable');
            
            const currentRecord = currentRes.rows[0];
            const oldStatus = currentRecord.status;
            
            if (oldStatus === 'ENTERED_IN_ERROR') {
                throw new Error('Une allergie marquée comme erreur ne peut pas être modifiée.');
            }
            if (oldStatus === newStatus) {
                await client.query('ROLLBACK');
                return;
            }

            await client.query(`
                UPDATE patient_allergies 
                SET status = $1, updated_at = now(), updated_by = $2
                WHERE id = $3
            `, [newStatus, updatedBy, allergyId]);

            await client.query(`
                INSERT INTO patient_allergy_history (
                    tenant_id, tenant_patient_id, patient_allergy_id, event_type, 
                    changed_field, old_value, new_value, created_by, created_by_first_name, created_by_last_name
                ) VALUES ($1, $2, $3, 'STATUS_CHANGED', 'status', $4, $5, $6, $7, $8)
            `, [
                tenantId, currentRecord.tenant_patient_id, allergyId, 
                oldStatus, newStatus, updatedBy, firstName, lastName
            ]);

            await client.query('COMMIT');

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async getAllergyHistory(tenantId: string, allergyId: string): Promise<PatientAllergyHistory[]> {
        const pool: Pool = getTenantPool(tenantId);
        // Includes users fetch if possible, but minimal for now just returning the rows, UI can map creator if needed
        const res = await pool.query(`
            SELECT *
            FROM patient_allergy_history 
            WHERE patient_allergy_id = $1 AND tenant_id = $2
            ORDER BY created_at ASC
        `, [allergyId, tenantId]);
        
        return res.rows;
    }
};
