import { Pool } from 'pg';

const GLOBAL_DB_URL = process.env.DATABASE_URL || 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });

export type CatalogTableName = 
    | 'lab_analytes' 
    | 'lab_methods' 
    | 'lab_specimen_types' 
    | 'lab_container_types' 
    | 'lab_sections' 
    | 'lab_sub_sections';

export const labCatalogRepository = {
    async findAll(table: CatalogTableName) {
        let query = `SELECT * FROM public.${table} ORDER BY sort_order ASC, code ASC`;

        const res = await globalPool.query(query);
        return res.rows;
    },

    async findByCode(table: CatalogTableName, code: string, excludeId?: string) {
        let query = `SELECT id FROM public.${table} WHERE LOWER(code) = LOWER($1)`;
        const params: any[] = [code];
        
        if (excludeId) {
            query += ` AND id != $2`;
            params.push(excludeId);
        }
        
        const res = await globalPool.query(query, params);
        return res.rows[0] || null;
    },

    async create(table: CatalogTableName, data: any) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
            INSERT INTO public.${table} (${columns.join(', ')}) 
            VALUES (${placeholders}) 
            RETURNING *
        `;
        const res = await globalPool.query(query, values);
        return res.rows[0];
    },

    async update(table: CatalogTableName, id: string, data: any) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        values.push(id); // $N
        
        const query = `
            UPDATE public.${table} 
            SET ${setClause}, updated_at = NOW() 
            WHERE id = $${values.length} 
            RETURNING *
        `;
        const res = await globalPool.query(query, values);
        return res.rows[0];
    },

    async setActivationStatus(table: CatalogTableName, id: string, actif: boolean) {
        const query = `
            UPDATE public.${table} 
            SET actif = $1, updated_at = NOW() 
            WHERE id = $2 
            RETURNING *
        `;
        const res = await globalPool.query(query, [actif, id]);
        return res.rows[0];
    },

};
