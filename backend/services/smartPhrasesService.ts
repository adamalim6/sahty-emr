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
    // --- SYSTEM SCOPE (GLOBAL DB) ---
    getSystemPhrases: async (): Promise<SmartPhrase[]> => {
        const { getGlobalPool } = require('../db/globalPg');
        const pool = getGlobalPool();
        const query = `
            SELECT * FROM smart_phrases
            WHERE scope = 'system'
            ORDER BY trigger ASC
        `;
        const { rows } = await pool.query(query);
        return rows as SmartPhrase[];
    },

    createSystemPhrase: async (phraseData: {
        trigger: string;
        label?: string;
        description?: string;
        body_html: string;
    }): Promise<SmartPhrase> => {
        const { getGlobalPool } = require('../db/globalPg');
        const pool = getGlobalPool();

        phraseData.trigger = phraseData.trigger.trim().toLowerCase();
        if (!/^[a-z0-9_-]{2,40}$/.test(phraseData.trigger)) {
            throw new Error(`Invalid trigger format: ${phraseData.trigger}`);
        }

        const triggerSearch = phraseData.trigger.replace(/[^a-z0-9]/g, '');

        // Pre-flight check for duplicate
        const checkRes = await pool.query(`SELECT id FROM smart_phrases WHERE LOWER(trigger) = $1`, [phraseData.trigger]);
        if (checkRes.rows.length > 0) {
            const err: any = new Error('A system phrase with this trigger already exists');
            err.statusCode = 409;
            throw err;
        }

        const query = `
            INSERT INTO smart_phrases (
                trigger, trigger_search, label, description, body_html, scope
            ) VALUES (
                $1, $2, $3, $4, $5, 'system'
            ) RETURNING *
        `;

        const values = [
            phraseData.trigger,
            triggerSearch,
            phraseData.label || null,
            phraseData.description || null,
            phraseData.body_html
        ];

        // Validate expansion purely within system scope
        await smartPhrasesService.validatePhraseExpansion(pool, null, null, phraseData.body_html, phraseData.trigger);

        const { rows } = await pool.query(query, values);
        return rows[0];
    },

    updateSystemPhrase: async (id: string, updates: Partial<SmartPhrase>): Promise<SmartPhrase> => {
        const { getGlobalPool } = require('../db/globalPg');
        const pool = getGlobalPool();
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.trigger !== undefined) {
            const normalizedTrigger = updates.trigger.trim().toLowerCase();
            if (!/^[a-z0-9_-]{2,40}$/.test(normalizedTrigger)) {
                throw new Error(`Invalid trigger format: ${normalizedTrigger}`);
            }
            
            // Pre-flight check
            const checkRes = await pool.query(`SELECT id FROM smart_phrases WHERE LOWER(trigger) = $1 AND id != $2`, [normalizedTrigger, id]);
            if (checkRes.rows.length > 0) {
                const err: any = new Error('A system phrase with this trigger already exists');
                err.statusCode = 409;
                throw err;
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

        const query = `
            UPDATE smart_phrases
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex} AND scope = 'system'
            RETURNING *
        `;

        if (updates.body_html !== undefined) {
             const triggerToCheck = updates.trigger || (await pool.query('SELECT trigger FROM smart_phrases WHERE id=$1', [id])).rows[0]?.trigger;
             await smartPhrasesService.validatePhraseExpansion(pool, null, null, updates.body_html, triggerToCheck);
        }

        const { rows } = await pool.query(query, values);
        if (rows.length === 0) {
            throw new Error('System phrase not found');
        }
        return rows[0];
    },

    // --- TENANT/USER SCOPE (TENANT DB) ---
    getPhrasesForUser: async (tenantId: string, userId: string): Promise<SmartPhrase[]> => {
        const pool = getTenantPool(tenantId);
        
        // Fetch active phrases. Trigger uniqueness is guaranteed by the database.
        const query = `
            SELECT * FROM smart_phrases
            WHERE tenant_id = $1
              AND is_active = TRUE
              AND (
                  (scope IN ('system', 'tenant'))
                  OR 
                  (scope = 'user' AND user_id = $2)
              )
            ORDER BY trigger ASC
        `;

        const { rows } = await pool.query(query, [tenantId, userId]);
        return rows as SmartPhrase[];
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
        phraseData.trigger = phraseData.trigger.trim().toLowerCase();
        
        if (!/^[a-z0-9_-]{2,40}$/.test(phraseData.trigger)) {
            throw new Error(`Invalid trigger format: ${phraseData.trigger}`);
        }

        // Pre-flight check for duplicates in the tenant DB
        const checkRes = await pool.query(`
            SELECT id FROM smart_phrases 
            WHERE tenant_id = $1 AND LOWER(trigger) = $2
        `, [phraseData.tenant_id, phraseData.trigger]);
        
        if (checkRes.rows.length > 0) {
            const err: any = new Error('A phrase with this trigger already exists in this tenant namespace');
            err.statusCode = 409;
            throw err;
        }

        const triggerSearch = phraseData.trigger.replace(/[^a-z0-9]/g, '');

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

        await smartPhrasesService.validatePhraseExpansion(pool, phraseData.tenant_id, phraseData.user_id || null, phraseData.body_html, phraseData.trigger);

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

            // Pre-flight check for duplicates
            const checkRes = await pool.query(`
                SELECT id FROM smart_phrases 
                WHERE tenant_id = $1 AND LOWER(trigger) = $2 AND id != $3
            `, [tenantId, normalizedTrigger, id]);
            
            if (checkRes.rows.length > 0) {
                const err: any = new Error('A phrase with this trigger already exists in this tenant namespace');
                err.statusCode = 409;
                throw err;
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

        if (updates.body_html !== undefined) {
             const triggerToCheck = updates.trigger || (await pool.query('SELECT trigger FROM smart_phrases WHERE id=$1 AND tenant_id=$2', [id, tenantId])).rows[0]?.trigger;
             // Here we lack userId from the updateRequest natively if it's not a user phrase. 
             // But we can extract user_id from the DB record if it's scope='user'.
             const phraseRow = (await pool.query('SELECT user_id FROM smart_phrases WHERE id=$1 AND tenant_id=$2', [id, tenantId])).rows[0];
             await smartPhrasesService.validatePhraseExpansion(pool, tenantId, phraseRow?.user_id || null, updates.body_html, triggerToCheck);
        }

        const { rows } = await pool.query(query, values);
        if (rows.length === 0) {
            throw new Error('Smart phrase not found or access denied');
        }
        return rows[0];
    },

    validatePhraseExpansion: async (pool: any, tenantId: string | null, userId: string | null, initialBodyHtml: string, initialTrigger?: string): Promise<void> => {
        const resolveRecursive = async (bodyHtml: string, depth: number, visitedTriggers: Set<string>): Promise<number> => {
            if (depth > 10) {
                const err: any = new Error('Maximum smart phrase recursion depth exceeded (10).');
                err.statusCode = 400; throw err;
            }

            const tokenRegex = /{{(.*?)}}/g;
            let match;
            const matches: string[] = [];
            while ((match = tokenRegex.exec(bodyHtml)) !== null) { matches.push(match[1]); }
            
            const uniqueTokens = [...new Set(matches)];
            let cursorCount = uniqueTokens.includes('cursor') ? 1 : 0;
            
            for (const token of uniqueTokens) {
                if (token === 'cursor') continue;

                let rows = [];
                if (tenantId) {
                    const query = `
                        SELECT body_html FROM smart_phrases
                        WHERE tenant_id = $1 AND LOWER(trigger) = LOWER($2) AND is_active = TRUE
                          AND (scope IN ('system', 'tenant') OR (scope = 'user' AND user_id = $3))
                        LIMIT 1
                    `;
                    rows = (await pool.query(query, [tenantId, token, userId])).rows;
                } else {
                    const query = `
                        SELECT body_html FROM smart_phrases
                        WHERE LOWER(trigger) = LOWER($1) AND scope = 'system' AND is_active = TRUE
                        LIMIT 1
                    `;
                    rows = (await pool.query(query, [token])).rows;
                }
                
                if (rows.length > 0) {
                    const tokenLower = token.toLowerCase();
                    if (visitedTriggers.has(tokenLower)) {
                        const err: any = new Error(`Cycle detected in smart phrase references: ${[...visitedTriggers, tokenLower].join(' -> ')}`);
                        err.statusCode = 400; throw err;
                    }
                    cursorCount += await resolveRecursive(rows[0].body_html, depth + 1, new Set([...visitedTriggers, tokenLower]));
                }
            }
            return cursorCount;
        };

        const initialSet = new Set<string>();
        if (initialTrigger) {
             initialSet.add(initialTrigger.toLowerCase());
        }

        const totalCursors = await resolveRecursive(initialBodyHtml, 1, initialSet);
        if (totalCursors > 1) {
            const err: any = new Error(`Validation failed: The fully expanded phrase contains ${totalCursors} cursors. Maximum allowed is 1.`);
            err.statusCode = 400;
            throw err;
        }
    },

    compilePhrase: async (tenantId: string, userId: string, tenantPatientId: string, phraseId: string): Promise<string> => {
        const pool = getTenantPool(tenantId);
        
        const resolveRecursive = async (
            currentPhraseId: string | null,
            currentTrigger: string | null,
            depth: number,
            visitedTriggers: Set<string>
        ): Promise<{ html: string, cursorCount: number }> => {
            
            if (depth > 10) {
                throw new Error('Maximum smart phrase recursion depth exceeded (10).');
            }

            let bodyHtml = '';
            
            if (currentPhraseId) {
                const query = `
                    SELECT body_html, trigger
                    FROM smart_phrases
                    WHERE id = $1 AND is_active = TRUE
                `;
                const { rows } = await pool.query(query, [currentPhraseId]);
                if (rows.length === 0) throw new Error('Phrase not found or not active');
                bodyHtml = rows[0].body_html;
                if (!currentTrigger) currentTrigger = rows[0].trigger;
            } else if (currentTrigger) {
                const query = `
                    SELECT body_html
                    FROM smart_phrases
                    WHERE tenant_id = $1
                      AND LOWER(trigger) = LOWER($2)
                      AND is_active = TRUE
                      AND (
                          (scope IN ('system', 'tenant'))
                          OR 
                          (scope = 'user' AND user_id = $3)
                      )
                    LIMIT 1
                `;
                const { rows } = await pool.query(query, [tenantId, currentTrigger, userId]);
                if (rows.length === 0) {
                    // Not found, leave unchanged
                    return { html: `{{${currentTrigger}}}`, cursorCount: 0 };
                }
                bodyHtml = rows[0].body_html;
            } else {
                throw new Error('Must provide either phraseId or trigger');
            }

            if (currentTrigger) {
                const triggerLower = currentTrigger.toLowerCase();
                if (visitedTriggers.has(triggerLower)) {
                    throw new Error(`Cycle detected in smart phrase references: ${[...visitedTriggers, triggerLower].join(' -> ')}`);
                }
                visitedTriggers.add(triggerLower);
            }

            const tokenRegex = /{{(.*?)}}/g;
            let match;
            const matches: string[] = [];
            while ((match = tokenRegex.exec(bodyHtml)) !== null) { matches.push(match[1]); }
            
            const uniqueTokens = [...new Set(matches)];
            let localCursorCount = uniqueTokens.includes('cursor') ? 1 : 0;
            const resolvedFragments = new Map<string, string>();
            const { smartValuesService } = await import('./smartValuesService');

            for (const token of uniqueTokens) {
                if (token === 'cursor') continue;

                try {
                    const fragment = await smartValuesService.resolveSmartValue(tenantId, tenantPatientId, token);
                    resolvedFragments.set(token, fragment);
                } catch (err: any) {
                    // Not a smart value -> recursive phrase compilation
                    const childResult = await resolveRecursive(null, token, depth + 1, new Set(visitedTriggers));
                    if (childResult.html !== `{{${token}}}`) {
                        localCursorCount += childResult.cursorCount;
                    }
                    resolvedFragments.set(token, childResult.html);
                }
            }

            for (const [token, fragment] of resolvedFragments.entries()) {
                const tokenRegexGlobal = new RegExp(`{{${token}}}`, 'g');
                bodyHtml = bodyHtml.replace(tokenRegexGlobal, fragment);
            }

            return { html: bodyHtml, cursorCount: localCursorCount };
        };

        const result = await resolveRecursive(phraseId, null, 1, new Set());
        
        if (result.cursorCount > 1) {
            throw new Error(`Compilation rejected: The fully expanded phrase contains ${result.cursorCount} cursors. Maximum allowed is 1.`);
        }

        return result.html;
    }
};
