import { getGlobalPool } from '../db/globalPg';
import { ObservationParameter, ObservationGroup, ObservationFlowsheet } from '../models/surveillance';
import { ReferenceUnit, ReferenceRoute } from '../models/units';
import { v4 as uuidv4 } from 'uuid';

class GlobalObservationCatalogService {
    // Basic in-memory cache for full flowsheets to meet caching requirement
    private flowsheetCache: any[] | null = null;

    private clearCache() {
        this.flowsheetCache = null;
    }

    // --- UNITS ---
    async getUnits(): Promise<ReferenceUnit[]> {
        const result = await getGlobalPool().query(
            `SELECT * FROM units ORDER BY sort_order`
        );
        return result.rows.map(this.mapUnit);
    }

    async createUnit(unit: Partial<ReferenceUnit>): Promise<ReferenceUnit> {
        const id = uuidv4();
        const result = await getGlobalPool().query(`
            INSERT INTO units (
                id, code, display, is_ucum, is_active, sort_order, requires_fluid_info
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            id, unit.code, unit.display, unit.isUcum || false, unit.isActive !== false, unit.sortOrder || 0, unit.requiresFluidInfo || false
        ]);
        return this.mapUnit(result.rows[0]);
    }

    async updateUnit(id: string, unit: Partial<ReferenceUnit>): Promise<ReferenceUnit> {
        const updates = [];
        const values: any[] = [];
        let index = 1;

        for (const [key, value] of Object.entries(unit)) {
            if (['id', 'createdAt', 'updatedAt'].includes(key)) continue;
            const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            updates.push(`${dbKey} = $${index}`);
            values.push(value);
            index++;
        }

        if (updates.length === 0) throw new Error('No fields to update');
        values.push(id);

        const result = await getGlobalPool().query(`
            UPDATE units SET ${updates.join(', ')}
            WHERE id = $${index}
            RETURNING *
        `, values);

        return this.mapUnit(result.rows[0]);
    }

    // --- ROUTES ---
    async getRoutes(): Promise<ReferenceRoute[]> {
        const result = await getGlobalPool().query(
            `SELECT * FROM public.routes ORDER BY sort_order`
        );
        return result.rows.map(this.mapRoute);
    }

    async createRoute(route: Partial<ReferenceRoute>): Promise<ReferenceRoute> {
        const id = uuidv4();
        const result = await getGlobalPool().query(`
            INSERT INTO public.routes (
                id, code, label, is_active, sort_order, requires_fluid_info
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            id, route.code, route.label, route.isActive !== false, route.sortOrder || 0, route.requiresFluidInfo || false
        ]);
        return this.mapRoute(result.rows[0]);
    }

    async updateRoute(id: string, route: Partial<ReferenceRoute>): Promise<ReferenceRoute> {
        const updates = [];
        const values: any[] = [];
        let index = 1;

        for (const [key, value] of Object.entries(route)) {
            if (['id', 'createdAt', 'updatedAt'].includes(key)) continue;
            const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            updates.push(`${dbKey} = $${index}`);
            values.push(value);
            index++;
        }

        if (updates.length === 0) throw new Error('No fields to update');
        values.push(id);

        const result = await getGlobalPool().query(`
            UPDATE public.routes SET ${updates.join(', ')}
            WHERE id = $${index}
            RETURNING *
        `, values);

        return this.mapRoute(result.rows[0]);
    }

    // --- PARAMETERS ---
    async getParameters(): Promise<ObservationParameter[]> {
        const result = await getGlobalPool().query(
            `SELECT * FROM observation_parameters ORDER BY sort_order`
        );
        return result.rows.map(this.mapParameter);
    }

    async createParameter(param: Partial<ObservationParameter>): Promise<ObservationParameter> {
        const id = uuidv4();
        const result = await getGlobalPool().query(`
            INSERT INTO observation_parameters (
                id, code, label, unit, unit_id, value_type,
                normal_min, normal_max, warning_min, warning_max,
                hard_min, hard_max, is_hydric_input, is_hydric_output, source, sort_order, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `, [
            id, param.code, param.label, param.unit, param.unitId || null, param.valueType,
            param.normalMin !== undefined ? param.normalMin : null, param.normalMax !== undefined ? param.normalMax : null,
            param.warningMin !== undefined ? param.warningMin : null, param.warningMax !== undefined ? param.warningMax : null,
            param.hardMin !== undefined ? param.hardMin : null, param.hardMax !== undefined ? param.hardMax : null,
            param.isHydricInput || false, param.isHydricOutput || false,
            param.source || 'manual', param.sortOrder || 0, param.isActive !== false
        ]);
        this.clearCache();
        return this.mapParameter(result.rows[0]);
    }

    async updateParameter(id: string, param: Partial<ObservationParameter>): Promise<ObservationParameter> {
        const updates = [];
        const values: any[] = [];
        let index = 1;

        for (const [key, value] of Object.entries(param)) {
            if (['id', 'createdAt', 'updatedAt'].includes(key)) continue;
            // Map camelCase to snake_case
            const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            updates.push(`${dbKey} = $${index}`);
            values.push(value);
            index++;
        }

        if (updates.length === 0) throw new Error('No fields to update');
        values.push(id);

        const result = await getGlobalPool().query(`
            UPDATE observation_parameters SET ${updates.join(', ')}
            WHERE id = $${index}
            RETURNING *
        `, values);

        this.clearCache();
        return this.mapParameter(result.rows[0]);
    }

    // --- GROUPS ---
    async getGroups(): Promise<ObservationGroup[]> {
        const result = await getGlobalPool().query(
            `SELECT g.*, COALESCE(
                json_agg(
                    json_build_object(
                        'id', p.id,
                        'code', p.code,
                        'label', p.label
                    )
                ) FILTER (WHERE p.id IS NOT NULL), '[]'
            ) as parameters
            FROM observation_groups g
            LEFT JOIN group_parameters gp ON gp.group_id = g.id
            LEFT JOIN observation_parameters p ON gp.parameter_id = p.id
            GROUP BY g.id
            ORDER BY g.sort_order`
        );
        return result.rows.map(row => {
            const grp = this.mapGroup(row);
            grp.parameters = row.parameters;
            return grp;
        });
    }

    async createGroup(group: Partial<ObservationGroup>, parameterIds: string[] = []): Promise<ObservationGroup> {
        const pool = getGlobalPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const id = uuidv4();
            const grp = await client.query(`
                INSERT INTO observation_groups (id, code, label, sort_order)
                VALUES ($1, $2, $3, $4) RETURNING *
            `, [id, group.code, group.label, group.sortOrder || 0]);

            if (parameterIds.length > 0) {
                // Insert group parameters
                const values = parameterIds.map((pId, i) => `('${id}', '${pId}', ${i})`).join(', ');
                await client.query(`INSERT INTO group_parameters (group_id, parameter_id, sort_order) VALUES ${values}`);
            }

            await client.query('COMMIT');
            this.clearCache();
            return this.mapGroup(grp.rows[0]);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async updateGroup(id: string, group: Partial<ObservationGroup>, parameterIds: string[] = []): Promise<ObservationGroup> {
        const pool = getGlobalPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const updates = [];
            const values = [];
            let index = 1;

            if (group.code !== undefined) { updates.push(`code = $${index++}`); values.push(group.code); }
            if (group.label !== undefined) { updates.push(`label = $${index++}`); values.push(group.label); }
            if (group.sortOrder !== undefined) { updates.push(`sort_order = $${index++}`); values.push(group.sortOrder); }

            let grp: any;
            if (updates.length > 0) {
                values.push(id);
                grp = await client.query(`
                    UPDATE observation_groups SET ${updates.join(', ')}
                    WHERE id = $${index}
                    RETURNING *
                `, values);
            } else {
                grp = await client.query(`SELECT * FROM observation_groups WHERE id = $1`, [id]);
            }

            if (!grp || grp.rows.length === 0) {
                throw new Error("Group not found");
            }

            // Sync group parameters
            await client.query(`DELETE FROM group_parameters WHERE group_id = $1`, [id]);
            
            if (parameterIds.length > 0) {
                const paramValues = parameterIds.map((pId, i) => `('${id}', '${pId}', ${i})`).join(', ');
                await client.query(`INSERT INTO group_parameters (group_id, parameter_id, sort_order) VALUES ${paramValues}`);
            }

            await client.query('COMMIT');
            this.clearCache();
            return this.mapGroup(grp.rows[0]);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    // --- FLOWSHEETS ---
    async getFlowsheets(includeStructure: boolean = true): Promise<any[]> {
        console.log(`[GlobalObservationCatalog] Serving from SAHTY_GLOBAL database`);
        if (includeStructure && this.flowsheetCache) {
            return this.flowsheetCache;
        }

        const pool = getGlobalPool();
        const flowsheets = await pool.query(
            `SELECT * FROM observation_flowsheets ORDER BY sort_order`
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
                SELECT g.* FROM observation_groups g
                JOIN flowsheet_groups fg ON fg.group_id = g.id
                WHERE fg.flowsheet_id = $1
                ORDER BY fg.sort_order
            `, [fs.id]);

            const groups = [];
            for (const grpRow of grpRes.rows) {
                const grp = this.mapGroup(grpRow);
                
                // Get Parameters for Group
                const paramRes = await pool.query(`
                    SELECT p.* FROM observation_parameters p
                    JOIN group_parameters gp ON gp.parameter_id = p.id
                    WHERE gp.group_id = $1 AND p.is_active = true
                    ORDER BY gp.sort_order
                `, [grp.id]);

                grp.parameters = paramRes.rows.map(this.mapParameter);
                groups.push(grp);
            }

            fs.groups = groups;
            mapped.push(fs);
        }

        this.flowsheetCache = mapped;
        return mapped;
    }

    async createFlowsheet(flowsheet: Partial<ObservationFlowsheet>, groupIds: string[] = []): Promise<ObservationFlowsheet> {
        const pool = getGlobalPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const id = uuidv4();
            const fs = await client.query(`
                INSERT INTO observation_flowsheets (id, code, label, sort_order, is_active)
                VALUES ($1, $2, $3, $4, $5) RETURNING *
            `, [id, flowsheet.code, flowsheet.label, flowsheet.sortOrder || 0, flowsheet.isActive !== false]);

            if (groupIds.length > 0) {
                const values = groupIds.map((gId, i) => `('${id}', '${gId}', ${i})`).join(', ');
                await client.query(`INSERT INTO flowsheet_groups (flowsheet_id, group_id, sort_order) VALUES ${values}`);
            }

            await client.query('COMMIT');
            this.clearCache();
            return this.mapFlowsheet(fs.rows[0]);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async updateFlowsheet(id: string, flowsheet: Partial<ObservationFlowsheet>, groupIds?: string[]): Promise<ObservationFlowsheet> {
        const pool = getGlobalPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const updates = [];
            const values: any[] = [];
            let index = 1;

            for (const [key, value] of Object.entries(flowsheet)) {
                if (['id', 'createdAt', 'updatedAt'].includes(key) || value === undefined) continue;
                // Map camelCase to snake_case
                const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                updates.push(`${dbKey} = $${index}`);
                values.push(value);
                index++;
            }

            let fsRow;
            if (updates.length > 0) {
                values.push(id);
                const result = await client.query(`
                    UPDATE observation_flowsheets SET ${updates.join(', ')}
                    WHERE id = $${index}
                    RETURNING *
                `, values);
                fsRow = result.rows[0];
            } else {
                const result = await client.query(`SELECT * FROM observation_flowsheets WHERE id = $1`, [id]);
                fsRow = result.rows[0];
            }

            if (groupIds !== undefined) {
                await client.query(`DELETE FROM flowsheet_groups WHERE flowsheet_id = $1`, [id]);
                if (groupIds.length > 0) {
                    const groupValues = groupIds.map((gId, i) => `('${id}', '${gId}', ${i})`).join(', ');
                    await client.query(`INSERT INTO flowsheet_groups (flowsheet_id, group_id, sort_order) VALUES ${groupValues}`);
                }
            }

            await client.query('COMMIT');
            this.clearCache();
            return this.mapFlowsheet(fsRow);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }


    // Mapping helpers
    private mapUnit(row: any): ReferenceUnit {
        return {
            id: row.id, code: row.code, display: row.display,
            isUcum: row.is_ucum, isActive: row.is_active, sortOrder: row.sort_order,
            requiresFluidInfo: row.requires_fluid_info,
            createdAt: row.created_at, updatedAt: row.updated_at
        };
    }

    private mapRoute(row: any): ReferenceRoute {
        return {
            id: row.id, code: row.code, label: row.label,
            isActive: row.is_active, sortOrder: row.sort_order,
            requiresFluidInfo: row.requires_fluid_info,
            createdAt: row.created_at, updatedAt: row.updated_at
        };
    }

    private mapParameter(row: any): ObservationParameter {
        return {
            id: row.id,
            code: row.code,
            label: row.label,
            unit: row.unit,
            unitId: row.unit_id,
            valueType: row.value_type,
            normalMin: row.normal_min !== null ? parseFloat(row.normal_min) : undefined,
            normalMax: row.normal_max !== null ? parseFloat(row.normal_max) : undefined,
            warningMin: row.warning_min !== null ? parseFloat(row.warning_min) : undefined,
            warningMax: row.warning_max !== null ? parseFloat(row.warning_max) : undefined,
            hardMin: row.hard_min !== null ? parseFloat(row.hard_min) : undefined,
            hardMax: row.hard_max !== null ? parseFloat(row.hard_max) : undefined,
            isHydricInput: !!row.is_hydric_input,
            isHydricOutput: !!row.is_hydric_output,
            source: row.source || 'manual',
            sortOrder: row.sort_order,
            isActive: !!row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at
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

export const globalObservationCatalogService = new GlobalObservationCatalogService();
