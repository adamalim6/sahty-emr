import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { PoolClient } from 'pg';

/**
 * Patient-level coverage registry.
 * A coverage is a policy contract (organisme + policy number + plan).
 * coverage_members lists who is on that policy — subscriber (SELF) + any dependents.
 */
export const coverageRepository = {

    async listCoverages(tenantId: string, filters?: { search?: string; status?: string }) {
        const params: any[] = [tenantId];
        let where = `c.tenant_id = $1`;
        if (filters?.status) {
            params.push(filters.status);
            where += ` AND c.status = $${params.length}`;
        }
        if (filters?.search) {
            params.push(`%${filters.search}%`);
            const idx = params.length;
            where += ` AND (
                c.policy_number ILIKE $${idx}
                OR c.group_number ILIKE $${idx}
                OR c.plan_name ILIKE $${idx}
                OR o.designation ILIKE $${idx}
                OR EXISTS (
                    SELECT 1 FROM coverage_members cm2
                    WHERE cm2.coverage_id = c.coverage_id
                      AND (
                          cm2.member_first_name ILIKE $${idx}
                          OR cm2.member_last_name ILIKE $${idx}
                          OR cm2.member_identity_value ILIKE $${idx}
                      )
                )
            )`;
        }
        return tenantQuery(tenantId, `
            SELECT
                c.coverage_id,
                c.organisme_id,
                o.designation AS organisme_designation,
                o.category    AS organisme_category,
                c.policy_number,
                c.group_number,
                c.plan_name,
                c.coverage_type_code,
                c.effective_from,
                c.effective_to,
                c.status,
                c.created_at,
                c.updated_at,
                (SELECT COUNT(*) FROM coverage_members cm WHERE cm.coverage_id = c.coverage_id) AS member_count
            FROM coverages c
            LEFT JOIN reference.organismes o ON o.id = c.organisme_id
            WHERE ${where}
            ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
            LIMIT 200
        `, params);
    },

    async getCoverage(tenantId: string, coverageId: string) {
        const rows = await tenantQuery(tenantId, `
            SELECT
                c.*,
                o.designation AS organisme_designation,
                o.category    AS organisme_category
            FROM coverages c
            LEFT JOIN reference.organismes o ON o.id = c.organisme_id
            WHERE c.tenant_id = $1 AND c.coverage_id = $2
        `, [tenantId, coverageId]);
        const coverage = rows[0];
        if (!coverage) return null;

        const members = await tenantQuery(tenantId, `
            SELECT
                cm.coverage_member_id,
                cm.coverage_id,
                cm.tenant_patient_id,
                cm.relationship_to_subscriber_code,
                cm.member_first_name,
                cm.member_last_name,
                cm.member_identity_type,
                cm.member_identity_value,
                cm.member_issuing_country,
                cm.created_at,
                pt.first_name AS linked_patient_first_name,
                pt.last_name  AS linked_patient_last_name,
                pt.dob        AS linked_patient_dob
            FROM coverage_members cm
            LEFT JOIN patients_tenant pt ON pt.tenant_patient_id = cm.tenant_patient_id
            WHERE cm.tenant_id = $1 AND cm.coverage_id = $2
            ORDER BY
                CASE WHEN cm.relationship_to_subscriber_code = 'SELF' THEN 0 ELSE 1 END,
                cm.created_at ASC
        `, [tenantId, coverageId]);

        return { ...coverage, members };
    },

    async createCoverage(tenantId: string, data: any, userId?: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            if (!data.organismeId) throw new Error('Organisme requis');
            if (!data.policyNumber) throw new Error('Numéro de police requis');

            const res = await client.query(`
                INSERT INTO coverages
                    (tenant_id, organisme_id, policy_number, group_number, plan_name, coverage_type_code,
                     effective_from, effective_to, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'ACTIVE'))
                RETURNING *
            `, [
                tenantId,
                data.organismeId,
                data.policyNumber,
                data.groupNumber || null,
                data.planName || null,
                data.coverageTypeCode || null,
                data.effectiveFrom || null,
                data.effectiveTo || null,
                data.status || null
            ]);
            return res.rows[0];
        }, userId ? { userId } : undefined);
    },

    async updateCoverage(tenantId: string, coverageId: string, data: any, userId?: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const existing = await client.query(
                `SELECT coverage_id FROM coverages WHERE tenant_id = $1 AND coverage_id = $2`,
                [tenantId, coverageId]
            );
            if (!existing.rows[0]) throw new Error('Couverture introuvable');

            const res = await client.query(`
                UPDATE coverages SET
                    organisme_id       = COALESCE($3, organisme_id),
                    policy_number      = COALESCE($4, policy_number),
                    group_number       = $5,
                    plan_name          = $6,
                    coverage_type_code = $7,
                    effective_from     = $8,
                    effective_to       = $9,
                    status             = COALESCE($10, status),
                    updated_at         = NOW()
                WHERE tenant_id = $1 AND coverage_id = $2
                RETURNING *
            `, [
                tenantId,
                coverageId,
                data.organismeId || null,
                data.policyNumber || null,
                data.groupNumber ?? null,
                data.planName ?? null,
                data.coverageTypeCode ?? null,
                data.effectiveFrom || null,
                data.effectiveTo || null,
                data.status || null
            ]);
            return res.rows[0];
        }, userId ? { userId } : undefined);
    },

    // ---------------- Members ----------------

    async addMember(tenantId: string, coverageId: string, data: any, userId?: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const cov = await client.query(
                `SELECT coverage_id FROM coverages WHERE tenant_id = $1 AND coverage_id = $2`,
                [tenantId, coverageId]
            );
            if (!cov.rows[0]) throw new Error('Couverture introuvable');

            const code = data.relationshipToSubscriberCode || 'SELF';
            if (code === 'SELF') {
                const dup = await client.query(`
                    SELECT coverage_member_id FROM coverage_members
                    WHERE tenant_id = $1 AND coverage_id = $2 AND relationship_to_subscriber_code = 'SELF'
                `, [tenantId, coverageId]);
                if (dup.rows[0]) throw new Error('Un titulaire (SELF) est déjà enregistré pour cette couverture');
            }

            const res = await client.query(`
                INSERT INTO coverage_members
                    (tenant_id, coverage_id, tenant_patient_id, relationship_to_subscriber_code,
                     member_first_name, member_last_name, member_identity_type,
                     member_identity_value, member_issuing_country)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                tenantId,
                coverageId,
                data.tenantPatientId || null,
                code,
                data.memberFirstName || null,
                data.memberLastName || null,
                data.memberIdentityType || null,
                data.memberIdentityValue || null,
                data.memberIssuingCountry || null
            ]);
            return res.rows[0];
        }, userId ? { userId } : undefined);
    },

    async updateMember(tenantId: string, memberId: string, data: any, userId?: string) {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const existing = await client.query(
                `SELECT coverage_member_id, coverage_id FROM coverage_members
                 WHERE tenant_id = $1 AND coverage_member_id = $2`,
                [tenantId, memberId]
            );
            if (!existing.rows[0]) throw new Error('Membre introuvable');

            if (data.relationshipToSubscriberCode === 'SELF') {
                const dup = await client.query(`
                    SELECT coverage_member_id FROM coverage_members
                    WHERE tenant_id = $1
                      AND coverage_id = $2
                      AND relationship_to_subscriber_code = 'SELF'
                      AND coverage_member_id <> $3
                `, [tenantId, existing.rows[0].coverage_id, memberId]);
                if (dup.rows[0]) throw new Error('Un autre titulaire (SELF) existe déjà pour cette couverture');
            }

            const res = await client.query(`
                UPDATE coverage_members SET
                    tenant_patient_id               = $3,
                    relationship_to_subscriber_code = COALESCE($4, relationship_to_subscriber_code),
                    member_first_name               = $5,
                    member_last_name                = $6,
                    member_identity_type            = $7,
                    member_identity_value           = $8,
                    member_issuing_country          = $9
                WHERE tenant_id = $1 AND coverage_member_id = $2
                RETURNING *
            `, [
                tenantId,
                memberId,
                data.tenantPatientId ?? null,
                data.relationshipToSubscriberCode || null,
                data.memberFirstName ?? null,
                data.memberLastName ?? null,
                data.memberIdentityType ?? null,
                data.memberIdentityValue ?? null,
                data.memberIssuingCountry ?? null
            ]);
            return res.rows[0];
        }, userId ? { userId } : undefined);
    },

    async removeMember(tenantId: string, memberId: string) {
        const rows = await tenantQuery(tenantId, `
            DELETE FROM coverage_members
            WHERE tenant_id = $1 AND coverage_member_id = $2
            RETURNING coverage_member_id
        `, [tenantId, memberId]);
        if (!rows[0]) throw new Error('Membre introuvable');
        return { removed: true, coverage_member_id: rows[0].coverage_member_id };
    }
};
