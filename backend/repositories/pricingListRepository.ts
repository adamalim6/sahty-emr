import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { PoolClient } from 'pg';

export const pricingListRepository = {

    // ==========================================
    // PRICING LISTS (HEADERS)
    // ==========================================

    async listPricingLists(tenantId: string, filters?: { search?: string; status?: string }) {
        let sql = `SELECT * FROM pricing_lists WHERE 1=1`;
        const params: any[] = [];
        let idx = 1;

        if (filters?.search) {
            sql += ` AND (code ILIKE $${idx} OR name ILIKE $${idx})`;
            params.push(`%${filters.search}%`);
            idx++;
        }
        if (filters?.status) {
            sql += ` AND status = $${idx}`;
            params.push(filters.status);
            idx++;
        }
        sql += ` ORDER BY updated_at DESC`;
        return tenantQuery(tenantId, sql, params);
    },

    async getPricingList(tenantId: string, id: string) {
        const rows = await tenantQuery(tenantId, `SELECT * FROM pricing_lists WHERE id = $1`, [id]);
        return rows[0] || null;
    },

    async createPricingList(tenantId: string, data: any, userId?: string) {
        const rows = await tenantQuery(tenantId, `
            INSERT INTO pricing_lists (code, name, description, currency_code, valid_from, valid_to, change_reason, created_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [data.code, data.name, data.description || null, data.currency_code || 'MAD',
            data.valid_from || null, data.valid_to || null, data.change_reason || null, userId || null]);
        return rows[0];
    },

    async updatePricingList(tenantId: string, id: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const current = await client.query(`SELECT status FROM pricing_lists WHERE id = $1`, [id]);
            if (!current.rows[0]) throw new Error('Grille tarifaire introuvable');
            if (current.rows[0].status !== 'DRAFT') throw new Error('Seules les grilles en brouillon peuvent être modifiées');

            const res = await client.query(`
                UPDATE pricing_lists SET
                    code = COALESCE($2, code), name = COALESCE($3, name), description = $4,
                    currency_code = COALESCE($5, currency_code),
                    valid_from = $6, valid_to = $7, change_reason = $8
                WHERE id = $1 RETURNING *
            `, [id, data.code, data.name, data.description ?? null,
                data.currency_code, data.valid_from || null, data.valid_to || null, data.change_reason || null]);
            return res.rows[0];
        });
    },

    async publishPricingList(tenantId: string, id: string, userId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const current = await client.query(`SELECT status FROM pricing_lists WHERE id = $1`, [id]);
            if (!current.rows[0]) throw new Error('Grille tarifaire introuvable');
            if (current.rows[0].status !== 'DRAFT') throw new Error('Seules les grilles en brouillon peuvent être publiées');

            const res = await client.query(`
                UPDATE pricing_lists SET status = 'PUBLISHED', published_at = NOW(), published_by_user_id = $2
                WHERE id = $1 RETURNING *
            `, [id, userId]);
            return res.rows[0];
        });
    },

    async archivePricingList(tenantId: string, id: string) {
        const rows = await tenantQuery(tenantId, `
            UPDATE pricing_lists SET status = 'ARCHIVED', is_active = FALSE WHERE id = $1 RETURNING *
        `, [id]);
        return rows[0];
    },

    async duplicatePricingList(tenantId: string, id: string, userId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const src = await client.query(`SELECT * FROM pricing_lists WHERE id = $1`, [id]);
            if (!src.rows[0]) throw new Error('Grille tarifaire introuvable');
            const s = src.rows[0];

            const maxVer = await client.query(
                `SELECT COALESCE(MAX(version_no), 0) + 1 as next FROM pricing_lists WHERE code = $1`, [s.code]);
            const nextVersion = maxVer.rows[0].next;

            const res = await client.query(`
                INSERT INTO pricing_lists (code, name, description, version_no, status, supersedes_pricing_list_id, currency_code, is_active, valid_from, valid_to, change_reason, created_by_user_id)
                VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, TRUE, $7, $8, $9, $10)
                RETURNING *
            `, [s.code, s.name, s.description, nextVersion, id, s.currency_code,
                s.valid_from, s.valid_to, 'Dupliqué depuis version ' + s.version_no, userId]);
            return res.rows[0];
        });
    },

    // ==========================================
    // PRICING LIST ITEMS
    // ==========================================

    async listItems(tenantId: string, pricingListId: string, showRemoved: boolean = false) {
        const statusFilter = showRemoved ? '' : `AND pli.membership_status = 'ACTIVE'`;
        return tenantQuery(tenantId, `
            SELECT
                pli.*,
                ga.code_sih, ga.libelle_sih, ga.type_acte,
                lv.version_no as latest_version_no,
                lv.status as latest_version_status,
                lv.unit_price as latest_unit_price,
                lv.billing_label as latest_billing_label,
                lv.valid_from as latest_valid_from,
                lv.valid_to as latest_valid_to,
                lv.updated_at as latest_version_updated_at
            FROM pricing_list_items pli
            JOIN reference.global_actes ga ON ga.id = pli.global_act_id
            LEFT JOIN LATERAL (
                SELECT * FROM pricing_list_item_versions v
                WHERE v.pricing_list_item_id = pli.id
                ORDER BY v.version_no DESC LIMIT 1
            ) lv ON TRUE
            WHERE pli.pricing_list_id = $1 ${statusFilter}
            ORDER BY ga.libelle_sih ASC
        `, [pricingListId]);
    },

    async addItem(tenantId: string, pricingListId: string, globalActId: string, userId?: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // Check if already exists (possibly removed)
            const existing = await client.query(
                `SELECT id, membership_status FROM pricing_list_items WHERE pricing_list_id = $1 AND global_act_id = $2`,
                [pricingListId, globalActId]);

            if (existing.rows[0]) {
                if (existing.rows[0].membership_status === 'ACTIVE') throw new Error('Cet acte est déjà dans la grille');
                // Reactivate
                const res = await client.query(`
                    UPDATE pricing_list_items SET membership_status = 'ACTIVE', removed_at = NULL, removed_by_user_id = NULL, removal_reason = NULL
                    WHERE id = $1 RETURNING *
                `, [existing.rows[0].id]);
                return res.rows[0];
            }

            const res = await client.query(`
                INSERT INTO pricing_list_items (pricing_list_id, global_act_id, added_by_user_id)
                VALUES ($1, $2, $3) RETURNING *
            `, [pricingListId, globalActId, userId || null]);
            return res.rows[0];
        });
    },

    async removeItem(tenantId: string, itemId: string, userId?: string, reason?: string) {
        const rows = await tenantQuery(tenantId, `
            UPDATE pricing_list_items SET membership_status = 'REMOVED', removed_at = NOW(), removed_by_user_id = $2, removal_reason = $3
            WHERE id = $1 RETURNING *
        `, [itemId, userId || null, reason || null]);
        return rows[0];
    },

    async reactivateItem(tenantId: string, itemId: string) {
        const rows = await tenantQuery(tenantId, `
            UPDATE pricing_list_items SET membership_status = 'ACTIVE', removed_at = NULL, removed_by_user_id = NULL, removal_reason = NULL
            WHERE id = $1 RETURNING *
        `, [itemId]);
        return rows[0];
    },

    // ==========================================
    // PRICING LIST ITEM VERSIONS
    // ==========================================

    async getItemVersions(tenantId: string, itemId: string) {
        const versions = await tenantQuery(tenantId, `
            SELECT v.*,
                   cu.display_name as created_by_name,
                   pu.display_name as published_by_name
            FROM pricing_list_item_versions v
            LEFT JOIN auth.users cu ON cu.user_id = v.created_by_user_id
            LEFT JOIN auth.users pu ON pu.user_id = v.published_by_user_id
            WHERE v.pricing_list_item_id = $1
            ORDER BY v.version_no DESC
        `, [itemId]);

        if (versions.length === 0) return [];

        const versionIds = versions.map((v: any) => v.id);
        const dispatches = await tenantQuery(tenantId, `
            SELECT * FROM pricing_list_item_version_dispatches
            WHERE pricing_list_item_version_id = ANY($1)
            ORDER BY sequence_no ASC
        `, [versionIds]);

        const dispatchMap = new Map<string, any[]>();
        dispatches.forEach((d: any) => {
            if (!dispatchMap.has(d.pricing_list_item_version_id)) dispatchMap.set(d.pricing_list_item_version_id, []);
            dispatchMap.get(d.pricing_list_item_version_id)!.push(d);
        });

        return versions.map((v: any) => ({ ...v, dispatches: dispatchMap.get(v.id) || [] }));
    },

    async createItemVersion(tenantId: string, itemId: string, data: any, userId?: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // Get next version number
            const maxVer = await client.query(
                `SELECT COALESCE(MAX(version_no), 0) + 1 as next FROM pricing_list_item_versions WHERE pricing_list_item_id = $1`, [itemId]);
            const nextVersion = maxVer.rows[0].next;

            // Find previous published version to set supersedes
            const prevPublished = await client.query(
                `SELECT id FROM pricing_list_item_versions WHERE pricing_list_item_id = $1 AND status = 'PUBLISHED' ORDER BY version_no DESC LIMIT 1`, [itemId]);

            const res = await client.query(`
                INSERT INTO pricing_list_item_versions
                    (pricing_list_item_id, version_no, unit_price, billing_label, valid_from, valid_to, change_reason, change_type, supersedes_version_id, created_by_user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [itemId, nextVersion, data.unit_price, data.billing_label || null,
                data.valid_from || null, data.valid_to || null, data.change_reason || null, data.change_type || null,
                prevPublished.rows[0]?.id || null, userId || null]);

            const version = res.rows[0];

            // Insert dispatches
            if (data.dispatches && data.dispatches.length > 0) {
                for (const d of data.dispatches) {
                    if (d.allocation_value == null || d.allocation_value === '') continue;
                    await client.query(`
                        INSERT INTO pricing_list_item_version_dispatches
                            (pricing_list_item_version_id, dispatch_type, sequence_no, allocation_value)
                        VALUES ($1, $2, $3, $4)
                    `, [version.id, d.dispatch_type, d.sequence_no || 1, d.allocation_value]);
                }
            }

            return version;
        });
    },

    async updateDraftVersion(tenantId: string, versionId: string, data: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const current = await client.query(`SELECT status FROM pricing_list_item_versions WHERE id = $1`, [versionId]);
            if (!current.rows[0]) throw new Error('Version introuvable');
            if (current.rows[0].status !== 'DRAFT') throw new Error('Seules les versions brouillon peuvent être modifiées');

            const res = await client.query(`
                UPDATE pricing_list_item_versions SET
                    unit_price = $2, billing_label = $3, valid_from = $4, valid_to = $5,
                    change_reason = $6, change_type = $7
                WHERE id = $1 RETURNING *
            `, [versionId, data.unit_price, data.billing_label || null,
                data.valid_from || null, data.valid_to || null, data.change_reason || null, data.change_type || null]);

            // Replace dispatches for this DRAFT version only
            await client.query(`DELETE FROM pricing_list_item_version_dispatches WHERE pricing_list_item_version_id = $1`, [versionId]);
            if (data.dispatches && data.dispatches.length > 0) {
                for (const d of data.dispatches) {
                    if (d.allocation_value == null || d.allocation_value === '') continue;
                    await client.query(`
                        INSERT INTO pricing_list_item_version_dispatches
                            (pricing_list_item_version_id, dispatch_type, sequence_no, allocation_value)
                        VALUES ($1, $2, $3, $4)
                    `, [versionId, d.dispatch_type, d.sequence_no || 1, d.allocation_value]);
                }
            }

            return res.rows[0];
        });
    },

    async publishItemVersion(tenantId: string, versionId: string, userId: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const current = await client.query(`SELECT * FROM pricing_list_item_versions WHERE id = $1`, [versionId]);
            if (!current.rows[0]) throw new Error('Version introuvable');
            if (current.rows[0].status !== 'DRAFT') throw new Error('Seules les versions brouillon peuvent être publiées');

            // Archive any currently published version for this item
            await client.query(`
                UPDATE pricing_list_item_versions SET status = 'ARCHIVED'
                WHERE pricing_list_item_id = $1 AND status = 'PUBLISHED'
            `, [current.rows[0].pricing_list_item_id]);

            const res = await client.query(`
                UPDATE pricing_list_item_versions SET status = 'PUBLISHED', published_at = NOW(), published_by_user_id = $2
                WHERE id = $1 RETURNING *
            `, [versionId, userId]);
            return res.rows[0];
        });
    },

    // ==========================================
    // ORGANISME ASSIGNMENTS
    // ==========================================

    async listOrganismes(tenantId: string, pricingListId: string) {
        return tenantQuery(tenantId, `
            SELECT plo.*, o.designation as organisme_designation, o.category as organisme_category
            FROM pricing_list_organismes plo
            JOIN reference.organismes o ON o.id = plo.organisme_id
            WHERE plo.pricing_list_id = $1
            ORDER BY o.designation ASC
        `, [pricingListId]);
    },

    async assignOrganisme(tenantId: string, pricingListId: string, organismeId: string, userId?: string, data?: any) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const existing = await client.query(
                `SELECT id, assignment_status FROM pricing_list_organismes WHERE pricing_list_id = $1 AND organisme_id = $2`,
                [pricingListId, organismeId]);

            if (existing.rows[0]) {
                if (existing.rows[0].assignment_status === 'ACTIVE') throw new Error('Cet organisme est déjà assigné');
                const res = await client.query(`
                    UPDATE pricing_list_organismes SET assignment_status = 'ACTIVE', removed_at = NULL, removed_by_user_id = NULL, removal_reason = NULL,
                        assigned_at = NOW(), assigned_by_user_id = $2, valid_from = $3, valid_to = $4
                    WHERE id = $1 RETURNING *
                `, [existing.rows[0].id, userId || null, data?.valid_from || null, data?.valid_to || null]);
                return res.rows[0];
            }

            const res = await client.query(`
                INSERT INTO pricing_list_organismes (pricing_list_id, organisme_id, assigned_by_user_id, valid_from, valid_to)
                VALUES ($1, $2, $3, $4, $5) RETURNING *
            `, [pricingListId, organismeId, userId || null, data?.valid_from || null, data?.valid_to || null]);
            return res.rows[0];
        });
    },

    async removeOrganisme(tenantId: string, assignmentId: string, userId?: string, reason?: string) {
        const rows = await tenantQuery(tenantId, `
            UPDATE pricing_list_organismes SET assignment_status = 'REMOVED', removed_at = NOW(), removed_by_user_id = $2, removal_reason = $3
            WHERE id = $1 RETURNING *
        `, [assignmentId, userId || null, reason || null]);
        return rows[0];
    },

    async reactivateOrganisme(tenantId: string, assignmentId: string) {
        const rows = await tenantQuery(tenantId, `
            UPDATE pricing_list_organismes SET assignment_status = 'ACTIVE', removed_at = NULL, removed_by_user_id = NULL, removal_reason = NULL
            WHERE id = $1 RETURNING *
        `, [assignmentId]);
        return rows[0];
    },

    // ==========================================
    // DICTIONARIES (for selectors)
    // ==========================================

    async searchGlobalActes(tenantId: string, search: string) {
        return tenantQuery(tenantId, `
            SELECT id, code_sih, libelle_sih, type_acte FROM reference.global_actes
            WHERE actif = true AND (code_sih ILIKE $1 OR libelle_sih ILIKE $1)
            ORDER BY libelle_sih ASC LIMIT 50
        `, [`%${search}%`]);
    },

    async listOrganismesForSelect(tenantId: string) {
        return tenantQuery(tenantId, `
            SELECT id, designation, category FROM reference.organismes
            WHERE active = true ORDER BY designation ASC
        `, []);
    }
};
