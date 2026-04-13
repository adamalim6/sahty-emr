import { tenantQuery } from '../db/tenantPg';

export const externalSystemService = {

    // ── External Systems ─────────────────────────────────────────────

    async getAll(tenantId: string) {
        return tenantQuery<any>(tenantId,
            `SELECT * FROM public.external_systems ORDER BY code`
        );
    },

    async create(tenantId: string, data: { code: string; label: string; is_active?: boolean }) {
        const rows = await tenantQuery<any>(tenantId, `
            INSERT INTO public.external_systems (code, label, is_active)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [data.code.toUpperCase().trim(), data.label.trim(), data.is_active !== false]);
        return rows[0];
    },

    async update(tenantId: string, id: string, data: { code?: string; label?: string; is_active?: boolean }) {
        const rows = await tenantQuery<any>(tenantId, `
            UPDATE public.external_systems
            SET code = COALESCE($1, code),
                label = COALESCE($2, label),
                is_active = COALESCE($3, is_active)
            WHERE id = $4
            RETURNING *
        `, [data.code?.toUpperCase().trim() || null, data.label?.trim() || null, data.is_active ?? null, id]);
        if (rows.length === 0) throw new Error('External system not found');
        return rows[0];
    },

    async delete(tenantId: string, id: string) {
        const rows = await tenantQuery<any>(tenantId,
            `DELETE FROM public.external_systems WHERE id = $1 RETURNING id`, [id]
        );
        if (rows.length === 0) throw new Error('External system not found');
        return { deleted: true };
    },

    // ── Global Act External Codes ────────────────────────────────────

    async getCodes(tenantId: string, filters?: { global_act_id?: string; external_system_id?: string }) {
        let sql = `
            SELECT gaec.*, 
                   es.code AS system_code, es.label AS system_label,
                   ga.libelle_sih AS act_label, ga.code_sih AS act_code
            FROM public.global_act_external_codes gaec
            JOIN public.external_systems es ON es.id = gaec.external_system_id
            JOIN reference.global_actes ga ON ga.id = gaec.global_act_id
        `;
        const params: any[] = [];
        const conditions: string[] = [];

        if (filters?.global_act_id) {
            params.push(filters.global_act_id);
            conditions.push(`gaec.global_act_id = $${params.length}`);
        }
        if (filters?.external_system_id) {
            params.push(filters.external_system_id);
            conditions.push(`gaec.external_system_id = $${params.length}`);
        }

        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY ga.libelle_sih, es.code';

        return tenantQuery<any>(tenantId, sql, params);
    },

    async createCode(tenantId: string, data: {
        global_act_id: string;
        external_system_id: string;
        external_code: string;
        is_active?: boolean;
    }) {
        const rows = await tenantQuery<any>(tenantId, `
            INSERT INTO public.global_act_external_codes (global_act_id, external_system_id, external_code, is_active)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [data.global_act_id, data.external_system_id, data.external_code.trim(), data.is_active !== false]);
        return rows[0];
    },

    async updateCode(tenantId: string, id: string, data: {
        external_code?: string;
        is_active?: boolean;
    }) {
        const rows = await tenantQuery<any>(tenantId, `
            UPDATE public.global_act_external_codes
            SET external_code = COALESCE($1, external_code),
                is_active = COALESCE($2, is_active),
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [data.external_code?.trim() || null, data.is_active ?? null, id]);
        if (rows.length === 0) throw new Error('Mapping not found');
        return rows[0];
    },

    async deleteCode(tenantId: string, id: string) {
        const rows = await tenantQuery<any>(tenantId,
            `DELETE FROM public.global_act_external_codes WHERE id = $1 RETURNING id`, [id]
        );
        if (rows.length === 0) throw new Error('Mapping not found');
        return { deleted: true };
    }
};
