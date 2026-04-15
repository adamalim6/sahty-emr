import { PoolClient } from 'pg';
import { LabAnalyteContext } from '../models/labReference';

export class LabReferenceRepository {
    async getAnalyteContextsByGlobalActs(client: PoolClient, globalActIds: string[]): Promise<LabAnalyteContext[]> {
        if (!globalActIds || globalActIds.length === 0) return [];

        const res = await client.query(
            `
            SELECT DISTINCT
                ac.id, ac.analyte_id, ac.specimen_type_id, ac.unit_id, ac.method_id,
                ac.analyte_label, ac.specimen_label, ac.unit_label, ac.method_label,
                ac.is_default, ac.actif
            FROM lab_analyte_contexts ac
            JOIN lab_act_contexts act_ctx ON act_ctx.analyte_context_id = ac.id
            WHERE act_ctx.global_act_id = ANY($1::uuid[]) AND ac.actif IS NOT FALSE AND act_ctx.actif IS NOT FALSE
            `,
            [globalActIds]
        );
        return res.rows;
    }

    async searchAnalyteContexts(client: PoolClient, query: string): Promise<LabAnalyteContext[]> {
        if (!query || query.trim().length === 0) return [];

        const searchPattern = '%' + query.trim() + '%';
        const res = await client.query(
            `
            SELECT 
                id, analyte_id, specimen_type_id, unit_id, method_id,
                analyte_label, specimen_label, unit_label, method_label,
                is_default, actif
            FROM lab_analyte_contexts
            WHERE actif IS NOT FALSE AND (
                analyte_label ILIKE $1 OR 
                specimen_label ILIKE $1 
            )
            ORDER BY analyte_label ASC
            LIMIT 50
            `,
            [searchPattern]
        );
        return res.rows;
    }

    async getAnalyteContextDetails(client: PoolClient, ids: string[]): Promise<LabAnalyteContext[]> {
        if (!ids || ids.length === 0) return [];

        const res = await client.query(
            `
            SELECT 
                id, analyte_id, specimen_type_id, unit_id, method_id,
                analyte_label, specimen_label, unit_label, method_label,
                is_default, actif
            FROM lab_analyte_contexts
            WHERE id = ANY($1::uuid[]) AND actif IS NOT FALSE
            `,
            [ids]
        );
        return res.rows;
    }

    async searchLabAnalytesOrActs(client: PoolClient, query: string): Promise<any[]> {
        if (!query || query.trim().length === 0) return [];

        const searchPattern = '%' + query.trim() + '%';
        const res = await client.query(
            `
            SELECT 
                'ANALYTE' as type, 
                lac.id, 
                lac.analyte_label as label, 
                lac.method_label, 
                lac.unit_label, 
                lac.specimen_label
            FROM lab_analyte_contexts lac
            WHERE lac.actif IS NOT FALSE
              AND lac.analyte_label ILIKE $1

            UNION ALL

            SELECT 
                'ACT' as type, 
                ga.id, 
                ga.libelle_sih as label, 
                NULL as method_label, 
                NULL as unit_label, 
                NULL as specimen_label
            FROM reference.global_actes ga
            JOIN reference.sih_sous_familles sf ON ga.sous_famille_id = sf.id
            JOIN reference.sih_familles f ON sf.famille_id = f.id
            WHERE f.code = 'BIOLOGIE' 
              AND ga.libelle_sih ILIKE $1

            LIMIT 20;
            `,
            [searchPattern]
        );
        return res.rows;
    }
}
