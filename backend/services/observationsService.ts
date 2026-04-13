import { getTenantPool } from '../db/tenantPg';
import { 
    CreateObservationPayload, 
    UpdateDraftObservationPayload, 
    CreateAddendumPayload, 
    PatientObservation 
} from '../models/observations';
import sanitizeHtml from 'sanitize-html';

export class ObservationsService {
    
    // Core sanitization logic shared across notes
    private sanitizeAndExtractPlain(html: string): { body_html: string, body_plain: string } {
        const cleanHtml = sanitizeHtml(html, {
            allowedTags: [
                "p", "br", "strong", "em", "ul", "ol", "li", "span", "h1", "h2", "h3", "blockquote"
            ],
            allowedAttributes: {}
        });
        
        // Strip everything for plain text version
        const plainText = sanitizeHtml(cleanHtml, {
            allowedTags: [],
            allowedAttributes: {}
        }).trim();
        
        return { body_html: cleanHtml, body_plain: plainText };
    }

    async createObservation(tenantId: string, authorId: string, authorRole: 'DOCTOR' | 'NURSE', authorFirstName: string, authorLastName: string, payload: CreateObservationPayload): Promise<PatientObservation> {
        const pool = getTenantPool(tenantId);
        const { body_html, body_plain } = this.sanitizeAndExtractPlain(payload.body_html);
        
        // Validate sizes
        if (body_html.length >= 200000) {
            throw new Error("Contenu de l'observation trop long (limite: 200KB)");
        }

        const signedAt = payload.status === 'SIGNED' ? new Date() : null;
        const signedBy = payload.status === 'SIGNED' ? authorId : null;

        let computedAdmissionId: string | null = null;
        try {
            const activeAdmissions = await pool.query(
                `SELECT id FROM admissions 
                 WHERE tenant_patient_id = $1 
                 AND discharge_date IS NULL 
                 AND status != 'DISCHARGED' 
                 ORDER BY admission_date DESC`,
                [payload.tenant_patient_id]
            );

            if (activeAdmissions.rows.length === 1) {
                computedAdmissionId = activeAdmissions.rows[0].id;
            }
        } catch (err) {
            console.error("Error auto-linking admission to observation:", err);
        }

        const result = await pool.query(
            `INSERT INTO patient_observations (
                tenant_patient_id, created_by, author_role, note_type, privacy_level, 
                status, declared_time, signed_at, signed_by, body_html, body_plain,
                linked_admission_id, linked_allergy_id, linked_addiction_id,
                author_first_name, author_last_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                payload.tenant_patient_id, authorId, authorRole, payload.note_type, 
                payload.privacy_level || 'NORMAL', payload.status, payload.declared_time, 
                signedAt, signedBy, body_html, body_plain,
                computedAdmissionId, payload.linked_allergy_id || null, 
                payload.linked_addiction_id || null, authorFirstName, authorLastName
            ]
        );
        return result.rows[0];
    }

    async updateDraftObservation(tenantId: string, observationId: string, authorId: string, payload: UpdateDraftObservationPayload): Promise<PatientObservation> {
        const pool = getTenantPool(tenantId);
        
        // Ensure note is DRAFT and belongs to user
        const check = await pool.query(`SELECT status, created_by FROM patient_observations WHERE id = $1`, [observationId]);
        if (check.rows.length === 0) throw new Error("Observation introuvable.");
        if (check.rows[0].status !== 'DRAFT') throw new Error("Vous ne pouvez modifier qu'une observation en brouillon.");
        if (check.rows[0].created_by !== authorId) throw new Error("Vous ne pouvez modifier que vos propres brouillons.");

        const updates: string[] = [];
        const values: any[] = [];
        let paramNum = 1;

        if (payload.body_html !== undefined) {
            const { body_html, body_plain } = this.sanitizeAndExtractPlain(payload.body_html);
            if (body_html.length >= 200000) throw new Error("Contenu trop long.");
            updates.push(`body_html = $${paramNum++}`, `body_plain = $${paramNum++}`);
            values.push(body_html, body_plain);
        }
        
        const directFields = ['note_type', 'privacy_level', 'declared_time', 'linked_admission_id', 'linked_allergy_id', 'linked_addiction_id'];
        for (const field of directFields) {
            if ((payload as any)[field] !== undefined) {
                updates.push(`${field} = $${paramNum++}`);
                values.push((payload as any)[field]);
            }
        }
        
        updates.push(`updated_at = now()`);
        values.push(observationId);

        const result = await pool.query(
            `UPDATE patient_observations SET ${updates.join(', ')} WHERE id = $${paramNum} RETURNING *`,
            values
        );
        return result.rows[0];
    }

    async signObservation(tenantId: string, observationId: string, authorId: string): Promise<PatientObservation> {
        const pool = getTenantPool(tenantId);
        
        // Ensure note is DRAFT and belongs to user
        const check = await pool.query(`SELECT status, created_by FROM patient_observations WHERE id = $1`, [observationId]);
        if (check.rows.length === 0) throw new Error("Observation introuvable.");
        if (check.rows[0].status !== 'DRAFT') throw new Error("Cette observation est déjà signée.");
        if (check.rows[0].created_by !== authorId) throw new Error("Vous ne pouvez signer que vos propres observations.");

        const result = await pool.query(
            `UPDATE patient_observations 
             SET status = 'SIGNED', signed_at = now(), signed_by = $2 
             WHERE id = $1 RETURNING *`,
            [observationId, authorId]
        );
        return result.rows[0];
    }

    async createAddendum(tenantId: string, parentObservationId: string, authorId: string, authorRole: 'DOCTOR' | 'NURSE', authorFirstName: string, authorLastName: string, payload: CreateAddendumPayload): Promise<PatientObservation> {
        const pool = getTenantPool(tenantId);
        
        // Parent must exist, be signed, and be a primary note
        const parentRes = await pool.query(
            `SELECT tenant_patient_id, status, parent_observation_id FROM patient_observations WHERE id = $1`, 
            [parentObservationId]
        );
        if (parentRes.rows.length === 0) throw new Error("Note parente introuvable.");
        const parent = parentRes.rows[0];
        
        if (parent.status !== 'SIGNED') throw new Error("La note parente doit d'abord être signée.");
        if (parent.parent_observation_id) throw new Error("Un addendum ne peut pas avoir un autre addendum comme parent.");

        const { body_html, body_plain } = this.sanitizeAndExtractPlain(payload.body_html);
        if (body_html.length >= 200000) throw new Error("Contenu trop long.");

        const result = await pool.query(
            `INSERT INTO patient_observations (
                tenant_patient_id, created_by, author_role, note_type, privacy_level, 
                status, declared_time, signed_at, signed_by, body_html, body_plain,
                parent_observation_id, author_first_name, author_last_name
            ) VALUES ($1, $2, $3, 'GENERAL', $4, 'SIGNED', $5, now(), $2, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                parent.tenant_patient_id, authorId, authorRole, 
                payload.privacy_level || 'NORMAL', payload.declared_time, 
                body_html, body_plain, parentObservationId, authorFirstName, authorLastName
            ]
        );
        return result.rows[0];
    }

    async listPatientObservations(tenantId: string, tenantPatientId: string): Promise<PatientObservation[]> {
        const pool = getTenantPool(tenantId);
        
        // We fetch all records (including drafts & addendums) logically ordered.
        // The UI will group Addendums appropriately via parent_observation_id.
        const res = await pool.query(`
            SELECT *
            FROM patient_observations
            WHERE tenant_patient_id = $1
            ORDER BY declared_time DESC, created_at DESC
        `, [tenantPatientId]);
        
        return res.rows;
    }
    async enterObservationInError(tenantId: string, observationId: string, authorId: string, reason?: string): Promise<PatientObservation> {
        const pool = getTenantPool(tenantId);

        const check = await pool.query(
            `SELECT status, parent_observation_id FROM patient_observations WHERE id = $1`,
            [observationId]
        );
        if (check.rows.length === 0) throw new Error('Observation introuvable.');
        if (check.rows[0].status === 'DRAFT') throw new Error('Supprimez le brouillon plutôt que de le saisir par erreur.');
        if (check.rows[0].status === 'ENTERED_IN_ERROR') throw new Error('Cette observation est déjà marquée comme saisie par erreur.');
        if (check.rows[0].parent_observation_id) throw new Error("Utilisez l'action sur la note parente.");

        // Mark the primary note
        const result = await pool.query(
            `UPDATE patient_observations
             SET status = 'ENTERED_IN_ERROR',
                 entered_in_error_by = $2,
                 entered_in_error_at = NOW(),
                 entered_in_error_reason = $3
             WHERE id = $1
             RETURNING *`,
            [observationId, authorId, reason ?? null]
        );

        // Cascade to all addendums
        await pool.query(
            `UPDATE patient_observations
             SET status = 'ENTERED_IN_ERROR',
                 entered_in_error_by = $2,
                 entered_in_error_at = NOW(),
                 entered_in_error_reason = $3
             WHERE parent_observation_id = $1`,
            [observationId, authorId, reason ?? null]
        );

        return result.rows[0];
    }
}

export const observationsService = new ObservationsService();
