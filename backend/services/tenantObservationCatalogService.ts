import { getTenantPool } from '../db/tenantPg';
import { ObservationParameter, ObservationGroup, ObservationFlowsheet } from '../models/surveillance';
import { ReferenceUnit } from '../models/units';

class TenantObservationCatalogService {
    // Basic in-memory cache for full flowsheets to meet caching requirement
    private flowsheetCache: Map<string, any[]> = new Map();

    // --- FLOWSHEETS ---
    async getFlowsheets(tenantId: string, includeStructure: boolean = true): Promise<any[]> {
        console.log(`[TenantObservationCatalog] Serving from strictly isolated tenant database: ${tenantId}`);
        if (includeStructure && this.flowsheetCache.has(tenantId)) {
            return this.flowsheetCache.get(tenantId)!;
        }

        const pool = getTenantPool(tenantId);
        const flowsheets = await pool.query(
            `SELECT * FROM reference.observation_flowsheets ORDER BY sort_order`
        );

        if (!includeStructure) {
            return flowsheets.rows.map(this.mapFlowsheet);
        }

        // Fetch structure: Flowsheets -> Groups -> Parameters
        const mapped = [];
        for (const row of flowsheets.rows) {
            const fs = this.mapFlowsheet(row);
            
            // Get Groups
            const grpRes = await pool.query(`
                SELECT g.* FROM reference.observation_groups g
                JOIN reference.flowsheet_groups fg ON fg.group_id = g.id
                WHERE fg.flowsheet_id = $1
                ORDER BY fg.sort_order
            `, [fs.id]);

            const groups = [];
            for (const grpRow of grpRes.rows) {
                const grp = this.mapGroup(grpRow);
                
                // Get Parameters for Group
                const paramRes = await pool.query(`
                    SELECT p.* FROM reference.observation_parameters p
                    JOIN reference.group_parameters gp ON gp.parameter_id = p.id
                    WHERE gp.group_id = $1 AND p.is_active = true
                    ORDER BY gp.sort_order
                `, [grp.id]);

                grp.parameters = paramRes.rows.map(this.mapParameter);
                groups.push(grp);
            }

            fs.groups = groups;
            mapped.push(fs);
        }

        this.flowsheetCache.set(tenantId, mapped);
        return mapped;
    }

    async getGroups(tenantId: string): Promise<ObservationGroup[]> {
        const pool = getTenantPool(tenantId);
        const result = await pool.query(
            `SELECT * FROM reference.observation_groups ORDER BY sort_order`
        );
        return result.rows.map(this.mapGroup);
    }

    async getParameters(tenantId: string): Promise<ObservationParameter[]> {
        const pool = getTenantPool(tenantId);
        const result = await pool.query(
            `SELECT * FROM reference.observation_parameters ORDER BY sort_order`
        );
        return result.rows.map(this.mapParameter);
    }

    async getUnits(tenantId: string): Promise<ReferenceUnit[]> {
        const pool = getTenantPool(tenantId);
        const result = await pool.query(
            `SELECT * FROM reference.units ORDER BY sort_order`
        );
        return result.rows.map(row => ({
            id: row.id,
            code: row.code,
            display: row.display,
            isUcum: row.is_ucum,
            isActive: row.is_active,
            sortOrder: row.sort_order
        }));
    }


    async getParameterByCode(tenantId: string, parameterCode: string): Promise<ObservationParameter | null> {
        const pool = getTenantPool(tenantId);
        const res = await pool.query(
            `SELECT * FROM reference.observation_parameters WHERE code = $1 AND is_active = true`,
            [parameterCode]
        );
        if (res.rows.length === 0) return null;
        return this.mapParameter(res.rows[0]);
    }

    // Mapping helpers
    private mapParameter(row: any): ObservationParameter {
        return {
            id: row.id, code: row.code, label: row.label,
            unit: row.unit, valueType: row.value_type,
            normalMin: row.normal_min !== null ? Number(row.normal_min) : undefined,
            normalMax: row.normal_max !== null ? Number(row.normal_max) : undefined,
            warningMin: row.warning_min !== null ? Number(row.warning_min) : undefined,
            warningMax: row.warning_max !== null ? Number(row.warning_max) : undefined,
            hardMin: row.hard_min !== null ? Number(row.hard_min) : undefined,
            hardMax: row.hard_max !== null ? Number(row.hard_max) : undefined,
            isHydricInput: row.is_hydric_input, isHydricOutput: row.is_hydric_output,
            sortOrder: row.sort_order, isActive: row.is_active,
            createdAt: row.created_at, updatedAt: row.updated_at
        };
    }

    private mapGroup(row: any): ObservationGroup {
        return {
            id: row.id, code: row.code, label: row.label,
            sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at
        };
    }

    private mapFlowsheet(row: any): ObservationFlowsheet {
        return {
            id: row.id, code: row.code, label: row.label,
            sortOrder: row.sort_order, isActive: row.is_active,
            createdAt: row.created_at, updatedAt: row.updated_at
        };
    }
}

export const tenantObservationCatalogService = new TenantObservationCatalogService();
