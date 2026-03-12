import { getTenantPool } from '../db/tenantPg';

export interface SmartPhrase {
    id: string;
    trigger: string;
    trigger_search: string;
    label: string | null;
    description: string | null;
    body_html: string;
    scope: 'tenant' | 'user';
    tenant_id: string | null;
    user_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export const smartPhrasesService = {
    getPhrasesForUser: async (tenantId: string, userId: string): Promise<SmartPhrase[]> => {
        const pool = getTenantPool(tenantId);
        // Fetch active tenant phrases AND user phrases for this specific user.
        // We will do deduplication in memory for clean override logic.
        const query = `
            SELECT * FROM smart_phrases
            WHERE tenant_id = $1
              AND is_active = TRUE
              AND (
                  (scope = 'tenant')
                  OR 
                  (scope = 'user' AND user_id = $2)
              )
            ORDER BY trigger ASC
        `;

        const { rows } = await pool.query(query, [tenantId, userId]);

        // Deduplication: User phrases override Tenant phrases if they share the same trigger.
        const phraseMap = new Map<string, SmartPhrase>();

        for (const phrase of rows as SmartPhrase[]) {
            const existing = phraseMap.get(phrase.trigger);
            if (!existing) {
                phraseMap.set(phrase.trigger, phrase);
            } else {
                // If a user phrase collides with a tenant phrase, keep the user phrase.
                if (phrase.scope === 'user' && existing.scope === 'tenant') {
                    phraseMap.set(phrase.trigger, phrase);
                }
            }
        }

        // Return the values sorted alphabetically by trigger
        return Array.from(phraseMap.values()).sort((a, b) => a.trigger.localeCompare(b.trigger));
    },

    createPhrase: async (
        phraseData: {
            trigger: string;
            label?: string;
            description?: string;
            body_html: string;
            scope: 'tenant' | 'user';
            tenant_id: string;
            user_id?: string;
            created_by?: string;
        }
    ): Promise<SmartPhrase> => {
        const pool = getTenantPool(phraseData.tenant_id);
        // Validate trigger
        phraseData.trigger = phraseData.trigger.trim().toLowerCase();
        
        if (!/^[a-z0-9_-]{2,40}$/.test(phraseData.trigger)) {
            throw new Error(`Invalid trigger format: ${phraseData.trigger}`);
        }

        const triggerSearch = phraseData.trigger.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (phraseData.scope === 'user' && !phraseData.user_id) {
            throw new Error('user_id is required for user-scoped smart phrases');
        }

        const query = `
            INSERT INTO smart_phrases (
                trigger, trigger_search, label, description, body_html, scope, tenant_id, user_id, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9
            ) RETURNING *
        `;

        const values = [
            phraseData.trigger,
            triggerSearch,
            phraseData.label || null,
            phraseData.description || null,
            phraseData.body_html,
            phraseData.scope,
            phraseData.tenant_id,
            phraseData.user_id || null,
            phraseData.created_by || null
        ];

        const { rows } = await pool.query(query, values);
        return rows[0];
    },

    updatePhrase: async (id: string, updates: Partial<SmartPhrase>, tenantId: string): Promise<SmartPhrase> => {
        const pool = getTenantPool(tenantId);
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.trigger !== undefined) {
            const normalizedTrigger = updates.trigger.trim().toLowerCase();
            if (!/^[a-z0-9_-]{2,40}$/.test(normalizedTrigger)) {
                throw new Error(`Invalid trigger format: ${normalizedTrigger}`);
            }
            fields.push(`trigger = $${paramIndex++}`);
            values.push(normalizedTrigger);
            
            const triggerSearch = normalizedTrigger.replace(/[^a-z0-9]/g, '');
            fields.push(`trigger_search = $${paramIndex++}`);
            values.push(triggerSearch);
        }

        if (updates.label !== undefined) {
            fields.push(`label = $${paramIndex++}`);
            values.push(updates.label);
        }

        if (updates.description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            values.push(updates.description);
        }

        if (updates.body_html !== undefined) {
            fields.push(`body_html = $${paramIndex++}`);
            values.push(updates.body_html);
        }

        if (updates.is_active !== undefined) {
            fields.push(`is_active = $${paramIndex++}`);
            values.push(updates.is_active);
        }

        if (fields.length === 0) {
            throw new Error('No fields provided to update');
        }

        fields.push(`updated_at = now()`);
        
        values.push(id);
        values.push(tenantId); // Security check

        const query = `
            UPDATE smart_phrases
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
            RETURNING *
        `;

        const { rows } = await pool.query(query, values);
        if (rows.length === 0) {
            throw new Error('Smart phrase not found or access denied');
        }
        return rows[0];
    }
};
