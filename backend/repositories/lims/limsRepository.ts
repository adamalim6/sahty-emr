import { tenantTransaction } from '../../db/tenantPg';
import { PoolClient } from 'pg';

export const limsRepository = {
    // ==========================================
    // *** PARAMÈTRES (ANALYTE CONTEXTS) ***
    // ==========================================
    async getAnalyteContexts(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                SELECT 
                    c.*,
                    a.code as analyte_code, a.libelle as analyte_libelle,
                    m.code as method_code, m.libelle as method_libelle,
                    s.code as specimen_code, s.libelle as specimen_libelle,
                    u.code as unit_code, u.display as unit_libelle
                FROM reference.lab_analyte_contexts c
                JOIN reference.lab_analytes a ON c.analyte_id = a.id
                LEFT JOIN reference.lab_methods m ON c.method_id = m.id
                LEFT JOIN reference.lab_specimen_types s ON c.specimen_type_id = s.id
                LEFT JOIN reference.units u ON c.unit_id = u.id
                ORDER BY a.libelle ASC, c.created_at DESC
            `;
            const res = await client.query(query);
            return res.rows;
        });
    },

    async createAnalyteContext(tenantId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            delete data.cached_value_type; // Never trust user input for this
            
            if (data.analyte_id) {
                const analyteRes = await client.query(`SELECT value_type FROM reference.lab_analytes WHERE id = $1`, [data.analyte_id]);
                if (analyteRes.rows.length > 0) {
                    data.cached_value_type = analyteRes.rows[0].value_type;
                }
            }

            const columns = Object.keys(data).join(', ');
            const values = Object.values(data);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

            const query = `
                INSERT INTO reference.lab_analyte_contexts (${columns}) 
                VALUES (${placeholders}) RETURNING *`;
            const res = await client.query(query, values);
            return res.rows[0];
        });
    },

    async updateAnalyteContext(tenantId: string, id: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            delete data.cached_value_type; // Never trust user input for this
            
            if (data.analyte_id) {
                const analyteRes = await client.query(`SELECT value_type FROM reference.lab_analytes WHERE id = $1`, [data.analyte_id]);
                if (analyteRes.rows.length > 0) {
                    data.cached_value_type = analyteRes.rows[0].value_type;
                }
            }

            const keys = Object.keys(data);
            if (keys.length === 0) {
                // If nothing to update, just return the current context
                const res = await client.query(`SELECT * FROM reference.lab_analyte_contexts WHERE id = $1`, [id]);
                return res.rows[0];
            }

            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            const values = [...Object.values(data), id];

            const query = `
                UPDATE reference.lab_analyte_contexts 
                SET ${setClause}, updated_at = NOW() 
                WHERE id = $${values.length} RETURNING *`;
            const res = await client.query(query, values);
            return res.rows[0];
        });
    },

    async setContextStatus(tenantId: string, id: string, actif: boolean) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `UPDATE reference.lab_analyte_contexts SET actif = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
            const res = await client.query(query, [actif, id]);
            return res.rows[0];
        });
    },

    // ==========================================
    // *** REFERENCE PROFILES ***
    // ==========================================
    async getReferenceProfiles(tenantId: string, contextId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                SELECT * FROM reference.lab_reference_profiles 
                WHERE analyte_context_id = $1 
                ORDER BY sort_order ASC, created_at ASC
            `;
            const res = await client.query(query, [contextId]);
            return res.rows;
        });
    },

    async createReferenceProfile(tenantId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // Remove legacy fields
            delete data.libelle;
            delete data.name;
            delete data.label;

            // Overlap Validation
            if (data.actif !== false) {
                const overlapQuery = `
                    SELECT 1
                    FROM reference.lab_reference_profiles
                    WHERE analyte_context_id = $1
                    AND sex = $2
                    AND actif = true
                    AND NOT (
                        COALESCE($3::numeric, 9999999) < COALESCE(age_min_days, 0)
                        OR COALESCE($4::numeric, 0) > COALESCE(age_max_days, 9999999)
                    )
                `;
                const overlapCheck = await client.query(overlapQuery, [
                    data.analyte_context_id,
                    data.sex,
                    data.age_max_days ?? null,
                    data.age_min_days ?? null
                ]);

                if (overlapCheck.rows.length > 0) {
                    throw new Error("A reference profile already exists for this sex and overlapping age range.");
                }
            }

            const columns = Object.keys(data).join(', ');
            const values = Object.values(data);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

            const query = `INSERT INTO reference.lab_reference_profiles (${columns}) VALUES (${placeholders}) RETURNING *`;
            const res = await client.query(query, values);
            return res.rows[0];
        });
    },
    
    async updateReferenceProfile(tenantId: string, id: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // Remove legacy fields
            delete data.libelle;
            delete data.name;
            delete data.label;

            const currentQ = await client.query(`SELECT * FROM reference.lab_reference_profiles WHERE id = $1`, [id]);
            const currentProfile = currentQ.rows[0];
            if (!currentProfile) throw new Error("Profile not found");

            const intendedState = { ...currentProfile, ...data };

            if (intendedState.actif === true) {
                const overlapQuery = `
                    SELECT 1
                    FROM reference.lab_reference_profiles
                    WHERE analyte_context_id = $1
                    AND sex = $2
                    AND actif = true
                    AND id != $5
                    AND NOT (
                        COALESCE($3::numeric, 9999999) < COALESCE(age_min_days, 0)
                        OR COALESCE($4::numeric, 0) > COALESCE(age_max_days, 9999999)
                    )
                `;
                const overlapCheck = await client.query(overlapQuery, [
                    intendedState.analyte_context_id,
                    intendedState.sex,
                    intendedState.age_max_days ?? null,
                    intendedState.age_min_days ?? null,
                    id
                ]);

                if (overlapCheck.rows.length > 0) {
                    throw new Error("A reference profile already exists for this sex and overlapping age range.");
                }
            }

            const keys = Object.keys(data);
            // If data is empty after deleting legacy fields, just return current
            if (keys.length === 0) return currentProfile;

            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            const values = [...Object.values(data), id];

            const query = `UPDATE reference.lab_reference_profiles SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
            const res = await client.query(query, values);
            return res.rows[0];
        });
    },

    async setProfileStatus(tenantId: string, id: string, actif: boolean) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `UPDATE reference.lab_reference_profiles SET actif = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
            const res = await client.query(query, [actif, id]);
            return res.rows[0];
        });
    },

    // ==========================================
    // *** REFERENCE RULES ***
    // ==========================================
    async getReferenceRules(tenantId: string, profileId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                SELECT * FROM reference.lab_reference_rules 
                WHERE profile_id = $1 
                ORDER BY priority ASC, sort_order ASC
            `;
            const res = await client.query(query, [profileId]);
            return res.rows;
        });
    },

    async createReferenceRule(tenantId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // STEP 1: Fetch parent cached_value_type
            const profileRes = await client.query(`
                SELECT c.cached_value_type 
                FROM reference.lab_reference_profiles p 
                JOIN reference.lab_analyte_contexts c ON p.analyte_context_id = c.id
                WHERE p.id = $1
            `, [data.profile_id]);
            
            if (profileRes.rows.length === 0) throw new Error("Parent profile not found");
            const valueType = profileRes.rows[0].cached_value_type;

            // STEP 2: Enforce Strict Guardrails
            if (valueType === 'NUMERIC') {
                data.canonical_value_id = null;
                data.reference_text = null;
            } else if (valueType === 'BOOLEAN' || valueType === 'TEXT' || valueType === 'CHOICE') {
                data.lower_numeric = null;
                data.upper_numeric = null;
                data.lower_inclusive = null;
                data.upper_inclusive = null;
                
                if (data.reference_text) {
                    throw new Error("Free text is not allowed for qualitative rules. You must select a canonical value.");
                }
                if (!data.canonical_value_id && (!data.canonical_value_min_id || !data.canonical_value_max_id)) {
                    throw new Error("A canonical value or range is required for qualitative rules.");
                }
                const cIds = [data.canonical_value_id, data.canonical_value_min_id, data.canonical_value_max_id].filter(Boolean);
                if (cIds.length > 0) {
                    const cRes = await client.query(`SELECT value_domain FROM reference.lab_canonical_allowed_values WHERE id = ANY($1)`, [cIds]);
                    const domains = new Set(cRes.rows.map(r => r.value_domain));
                    if (domains.size > 1) {
                        throw new Error("Canonical values must belong to the same category (value_domain).");
                    }
                }
            }
            
            // STEP 3: Validate Canonical IDs against Interpretation constraints
            const forbiddenCodes = ['NORMAL', 'ABNORMAL', 'ABNORMAL_LOW', 'ABNORMAL_HIGH', 'CAUTION', 'CAUTION_LOW', 'CAUTION_HIGH'];
            
            const checkCanonicalId = async (idToCheck: string | null | undefined) => {
                if (!idToCheck) return;
                const canRes = await client.query(`SELECT code FROM reference.lab_canonical_allowed_values WHERE id = $1`, [idToCheck]);
                if (canRes.rows.length > 0 && forbiddenCodes.includes(canRes.rows[0].code)) {
                    throw new Error("Interpretation values cannot be used as canonical values.");
                }
            };

            await checkCanonicalId(data.canonical_value_id);
            await checkCanonicalId(data.canonical_value_min_id);
            await checkCanonicalId(data.canonical_value_max_id);

            // Temporary compat buffer: rule_type DB column might still exist with NOT NULL prior to migration
            data.rule_type = 'MIGRATING_AWAY';

            const columns = Object.keys(data).join(', ');
            const values = Object.values(data);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

            const query = `INSERT INTO reference.lab_reference_rules (${columns}) VALUES (${placeholders}) RETURNING *`;
            const res = await client.query(query, values);
            return res.rows[0];
        });
    },

    async updateReferenceRule(tenantId: string, id: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // Retrieve current rule to get profile_id and existing state
            const currentRuleRes = await client.query(`SELECT * FROM reference.lab_reference_rules WHERE id = $1`, [id]);
            if (currentRuleRes.rows.length === 0) throw new Error("Rule not found");
            const currentRule = currentRuleRes.rows[0];
            const profileId = data.profile_id || currentRule.profile_id;

            // Fetch parent cached_value_type
            const profileRes = await client.query(`
                SELECT c.cached_value_type 
                FROM reference.lab_reference_profiles p 
                JOIN reference.lab_analyte_contexts c ON p.analyte_context_id = c.id
                WHERE p.id = $1
            `, [profileId]);
            
            if (profileRes.rows.length > 0) {
                const valueType = profileRes.rows[0].cached_value_type;
                if (valueType === 'NUMERIC') {
                    data.canonical_value_id = null;
                    data.reference_text = null;
                } else if (valueType === 'BOOLEAN' || valueType === 'TEXT' || valueType === 'CHOICE') {
                    data.lower_numeric = null;
                    data.upper_numeric = null;
                    data.lower_inclusive = null;
                    data.upper_inclusive = null;
                    
                    if (data.reference_text) {
                        throw new Error("Free text is not allowed for qualitative rules. You must select a canonical value.");
                    }
                    
                    // For updates, we fetch the intended state to validate
                    const intendedCanonicalId = 'canonical_value_id' in data ? data.canonical_value_id : currentRule.canonical_value_id;
                    const intendedMinId = 'canonical_value_min_id' in data ? data.canonical_value_min_id : currentRule.canonical_value_min_id;
                    const intendedMaxId = 'canonical_value_max_id' in data ? data.canonical_value_max_id : currentRule.canonical_value_max_id;
                    
                    if (!intendedCanonicalId && (!intendedMinId || !intendedMaxId)) {
                        throw new Error("A canonical value or range is required for qualitative rules.");
                    }
                    
                    const cIds = [intendedCanonicalId, intendedMinId, intendedMaxId].filter(Boolean);
                    if (cIds.length > 0) {
                        const cRes = await client.query(`SELECT value_domain FROM reference.lab_canonical_allowed_values WHERE id = ANY($1)`, [cIds]);
                        const domains = new Set(cRes.rows.map(r => r.value_domain));
                        if (domains.size > 1) {
                            throw new Error("Canonical values must belong to the same category (value_domain).");
                        }
                    }
                }
            }

            // Validate Canonical IDs against Interpretation constraints
            const forbiddenCodes = ['NORMAL', 'ABNORMAL', 'ABNORMAL_LOW', 'ABNORMAL_HIGH', 'CAUTION', 'CAUTION_LOW', 'CAUTION_HIGH'];
            
            const checkCanonicalId = async (idToCheck: string | null | undefined) => {
                if (!idToCheck) return;
                const canRes = await client.query(`SELECT code FROM reference.lab_canonical_allowed_values WHERE id = $1`, [idToCheck]);
                if (canRes.rows.length > 0 && forbiddenCodes.includes(canRes.rows[0].code)) {
                    throw new Error("Interpretation values cannot be used as canonical values.");
                }
            };

            await checkCanonicalId(data.canonical_value_id);
            await checkCanonicalId(data.canonical_value_min_id);
            await checkCanonicalId(data.canonical_value_max_id);

            // Temporary compat buffer: rule_type DB column might still exist
            if ('rule_type' in data) data.rule_type = 'MIGRATING_AWAY';

            const keys = Object.keys(data);
            if (keys.length === 0) {
                 const res = await client.query(`SELECT * FROM reference.lab_reference_rules WHERE id = $1`, [id]);
                 return res.rows[0];
            }
            
            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            const values = [...Object.values(data), id];

            const query = `UPDATE reference.lab_reference_rules SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
            const res = await client.query(query, values);
            return res.rows[0];
        });
    },

    async setRuleStatus(tenantId: string, id: string, actif: boolean) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `UPDATE reference.lab_reference_rules SET actif = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
            const res = await client.query(query, [actif, id]);
            return res.rows[0];
        });
    },

    // ==========================================
    // *** CHAPITRES (SECTION TREE) ***
    // ==========================================
    async getSectionTree(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                SELECT 
                    t.*, 
                    s.code as section_code, s.libelle as section_label,
                    sf.code as sous_famille_code, sf.libelle as sous_famille_label
                FROM reference.lab_section_tree t
                JOIN reference.lab_sections s ON t.section_id = s.id
                JOIN reference.sih_sous_familles sf ON t.sous_famille_id = sf.id
                ORDER BY t.sort_order ASC, s.code ASC
            `;
            const res = await client.query(query);
            return res.rows;
        });
    },

    async createSectionTree(tenantId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                INSERT INTO reference.lab_section_tree (sous_famille_id, section_id, sort_order, actif) 
                VALUES ($1, $2, $3, $4) RETURNING *`;
            const res = await client.query(query, [data.sous_famille_id, data.section_id, data.sort_order || 0, data.actif ?? true]);
            return res.rows[0];
        });
    },

    async setSectionTreeStatus(tenantId: string, id: string, actif: boolean) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `UPDATE reference.lab_section_tree SET actif = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
            const res = await client.query(query, [actif, id]);
            return res.rows[0];
        });
    },

    async updateSectionTreeOrder(tenantId: string, id: string, sortOrder: number) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `UPDATE reference.lab_section_tree SET sort_order = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
            const res = await client.query(query, [sortOrder, id]);
            return res.rows[0];
        });
    },

    async updateSectionTree(tenantId: string, id: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                UPDATE reference.lab_section_tree 
                SET sous_famille_id = $1, section_id = $2, sort_order = $3, actif = $4, updated_at = NOW() 
                WHERE id = $5 RETURNING *`;
            const res = await client.query(query, [data.sous_famille_id, data.section_id, data.sort_order || 0, data.actif ?? true, id]);
            return res.rows[0];
        });
    },

    // ==========================================
    // *** SOUS-CHAPITRES (SUB-SECTION TREE) ***
    // ==========================================
    async getSubSectionTree(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                SELECT 
                    t.*, 
                    ss.code as sub_section_code, ss.libelle as sub_section_label,
                    s.code as section_code, s.libelle as section_label
                FROM reference.lab_sub_section_tree t
                JOIN reference.lab_sub_sections ss ON t.sub_section_id = ss.id
                JOIN reference.lab_sections s ON t.section_id = s.id
                ORDER BY t.sort_order ASC, ss.code ASC
            `;
            const res = await client.query(query);
            return res.rows;
        });
    },

    async createSubSectionTree(tenantId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                INSERT INTO reference.lab_sub_section_tree (section_id, sub_section_id, sort_order, actif) 
                VALUES ($1, $2, $3, $4) RETURNING *`;
            const res = await client.query(query, [data.section_id, data.sub_section_id, data.sort_order || 0, data.actif ?? true]);
            return res.rows[0];
        });
    },

    async setSubSectionTreeStatus(tenantId: string, id: string, actif: boolean) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `UPDATE reference.lab_sub_section_tree SET actif = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
            const res = await client.query(query, [actif, id]);
            return res.rows[0];
        });
    },

    async updateSubSectionTreeOrder(tenantId: string, id: string, sortOrder: number) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `UPDATE reference.lab_sub_section_tree SET sort_order = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
            const res = await client.query(query, [sortOrder, id]);
            return res.rows[0];
        });
    },

    async updateSubSectionTree(tenantId: string, id: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                UPDATE reference.lab_sub_section_tree 
                SET section_id = $1, sub_section_id = $2, sort_order = $3, actif = $4, updated_at = NOW() 
                WHERE id = $5 RETURNING *`;
            const res = await client.query(query, [data.section_id, data.sub_section_id, data.sort_order || 0, data.actif ?? true, id]);
            return res.rows[0];
        });
    },

    // ==========================================
    // *** ACTES BIOLOGIQUES (BIOLOGY MAPS) ***
    // ==========================================
    async getBiologyActs(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                SELECT 
                  a.id,
                  a.code_sih AS code,
                  a.libelle_sih AS titre,

                  (
                    SELECT COUNT(*) 
                    FROM reference.lab_act_contexts lac
                    WHERE lac.global_act_id = a.id
                  ) AS context_count,

                  (
                    SELECT COUNT(*) 
                    FROM reference.lab_act_specimen_containers lst
                    WHERE lst.global_act_id = a.id
                  ) AS specimen_count

                FROM reference.global_actes a
                WHERE a.type_acte = 'BIOLOGY'
                AND a.actif = true
                ORDER BY a.libelle_sih ASC;
            `;
            const res = await client.query(query);
            return res.rows;
        });
    },

    async getBiologyActDetails(tenantId: string, actId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // General info
            const actQ = await client.query(`SELECT * FROM reference.global_actes WHERE id = $1`, [actId]);
            const act = actQ.rows[0];

            // Taxonomy Assignment
            const taxQ = await client.query(`
                SELECT t.*, sf.libelle as sous_famille_label, s.libelle as section_label, ss.libelle as sub_section_label
                FROM reference.lab_act_taxonomy t
                LEFT JOIN reference.sih_sous_familles sf ON t.sous_famille_id = sf.id
                LEFT JOIN reference.lab_sections s ON t.section_id = s.id
                LEFT JOIN reference.lab_sub_sections ss ON t.sub_section_id = ss.id
                WHERE t.act_id = $1
            `, [actId]);
            
            // Context Assignments
            const paramQ = await client.query(`
                SELECT ac.*, c.analyte_label, c.method_label, c.specimen_label, c.unit_label
                FROM reference.lab_act_contexts ac
                JOIN reference.lab_analyte_contexts c ON ac.analyte_context_id = c.id
                WHERE ac.global_act_id = $1 AND ac.actif = true
                ORDER BY ac.sort_order ASC
            `, [actId]);

            // Specimen/Container Assignments
            const specQ = await client.query(`
                SELECT ast.*, st.libelle as specimen_label,
                       ct.libelle as container_label, ct.tube_color as container_color
                FROM reference.lab_act_specimen_containers ast
                JOIN reference.lab_specimen_types st ON ast.specimen_type_id = st.id
                JOIN reference.lab_container_types ct ON ast.container_type_id = ct.id
                WHERE ast.global_act_id = $1
                ORDER BY ast.sort_order ASC
            `, [actId]);

            return {
                act,
                taxonomy: taxQ.rows[0] || null,
                contexts: paramQ.rows,
                specimens: specQ.rows
            };
        });
    },

    async assignActTaxonomy(tenantId: string, actId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                INSERT INTO reference.lab_act_taxonomy (act_id, sous_famille_id, section_id, sub_section_id, actif)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (act_id) DO UPDATE 
                SET sous_famille_id = EXCLUDED.sous_famille_id,
                    section_id = EXCLUDED.section_id,
                    sub_section_id = EXCLUDED.sub_section_id,
                    actif = EXCLUDED.actif,
                    updated_at = NOW()
                RETURNING *
            `;
            const res = await client.query(query, [
                actId, data.sous_famille_id, data.section_id, data.sub_section_id || null, data.actif ?? true
            ]);
            return res.rows[0];
        });
    },

    async assignActContext(tenantId: string, actId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                INSERT INTO reference.lab_act_contexts (global_act_id, analyte_context_id, is_default, actif, sort_order)
                VALUES ($1, $2, $3, $4, $5) RETURNING *
            `;
            const res = await client.query(query, [
                actId, data.analyte_context_id, data.is_default || false, data.actif ?? true, data.sort_order || 0
            ]);
            return res.rows[0];
        });
    },

    async unassignActContext(tenantId: string, assignmentId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            await client.query(`DELETE FROM reference.lab_act_contexts WHERE id = $1`, [assignmentId]);
            return { success: true };
        });
    },

    async assignActSpecimenContainer(tenantId: string, actId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const query = `
                INSERT INTO reference.lab_act_specimen_containers (global_act_id, specimen_type_id, container_type_id, min_volume, is_default, is_required, actif, sort_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
            `;
            const res = await client.query(query, [
                actId, data.specimen_type_id, data.container_type_id, data.min_volume || null, data.is_default || false, data.is_required ?? true, data.actif ?? true, data.sort_order || 0
            ]);
            return res.rows[0];
        });
    },

    async unassignActSpecimenContainer(tenantId: string, assignmentId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            await client.query(`DELETE FROM reference.lab_act_specimen_containers WHERE id = $1`, [assignmentId]);
            return { success: true };
        });
    },

    // ==========================================
    // *** BASELINE DICTIONARIES (READ-ONLY) ***
    // ==========================================
    async getSousFamilles(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, code, libelle FROM reference.sih_sous_familles WHERE actif = true ORDER BY code ASC`);
            return res.rows;
        });
    },
    async getSections(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, code, libelle FROM reference.lab_sections WHERE actif = true ORDER BY code ASC`);
            return res.rows;
        });
    },
    async getSubSections(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, code, libelle FROM reference.lab_sub_sections WHERE actif = true ORDER BY code ASC`);
            return res.rows;
        });
    },
    async getAnalytes(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, code, libelle FROM reference.lab_analytes WHERE actif = true ORDER BY libelle ASC`);
            return res.rows;
        });
    },
    async getMethods(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, code, libelle FROM reference.lab_methods WHERE actif = true ORDER BY libelle ASC`);
            return res.rows;
        });
    },
    async getSpecimenTypes(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, code, libelle FROM reference.lab_specimen_types WHERE actif = true ORDER BY libelle ASC`);
            return res.rows;
        });
    },
    async getUnits(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, code, display as libelle FROM reference.units WHERE actif = true ORDER BY display ASC`);
            return res.rows;
        });
    },
    async getContainers(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, code, libelle, tube_color FROM reference.lab_container_types WHERE actif = true ORDER BY libelle ASC`);
            return res.rows;
        });
    },
    async getSpecimenContainerTypes(tenantId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const res = await client.query(`SELECT id, specimen_type_id, container_type_id, is_default FROM reference.lab_specimen_container_types WHERE actif = true`);
            return res.rows;
        });
    },

    // ==========================================
    // *** CANONICAL VALUES ***
    // ==========================================
    async getCanonicalValues(tenantId: string, domain?: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            let query = `SELECT id, code, label, value_domain as domain, ordinal_rank as rank FROM reference.lab_canonical_allowed_values WHERE actif = true`;
            const params: any[] = [];
            if (domain) {
                query += ` AND value_domain = $1`;
                params.push(domain);
            }
            query += ` ORDER BY value_domain ASC, ordinal_rank ASC`;
            const res = await client.query(query, params);
            return res.rows;
        });
    }
};
