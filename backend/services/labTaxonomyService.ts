import { db } from '../db';
import { PoolClient } from 'pg';

export const LabTaxonomyService = {
    /**
     * Retrieves all lab sections mapped to a specific sous-famille for a given tenant.
     * Extracts definitions from sahty_global via federated connection or assumes mirrored reference data,
     * but strictly joins via the tenant's localized reference.lab_section_tree mapping.
     */
    async getSectionsBySousFamille(tenantId: string, sousFamilleId: string, client?: PoolClient) {
        return db.withTenantClient(tenantId, async (tenantClient) => {
            const runner = client || tenantClient;
            
            const query = `
                SELECT s.*
                FROM reference.lab_sections s
                JOIN reference.lab_section_tree t ON t.section_id = s.id
                WHERE t.sous_famille_id = $1
                  AND t.actif = true
                ORDER BY t.sort_order ASC, s.code ASC
            `;
            
            const res = await runner.query(query, [sousFamilleId]);
            return res.rows;
        });
    },

    /**
     * Retrieves all lab sub-sections mapped to a specific section for a given tenant.
     * Joins flat definitions via the localized reference.lab_sub_section_tree mapping.
     */
    async getSubSectionsBySection(tenantId: string, sectionId: string, client?: PoolClient) {
        return db.withTenantClient(tenantId, async (tenantClient) => {
            const runner = client || tenantClient;

            const query = `
                SELECT ss.*
                FROM reference.lab_sub_sections ss
                JOIN reference.lab_sub_section_tree t ON t.sub_section_id = ss.id
                WHERE t.section_id = $1
                  AND t.actif = true
                ORDER BY t.sort_order ASC, ss.code ASC
            `;
            
            const res = await runner.query(query, [sectionId]);
            return res.rows;
        });
    }
};
