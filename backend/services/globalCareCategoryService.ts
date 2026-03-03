import { getGlobalPool } from '../db/globalPg';
import { CareCategory } from '../models/careCategories';
import { v4 as uuidv4 } from 'uuid';

export class GlobalCareCategoryService {
    
    // Map DB row to model
    private mapRow(row: any): CareCategory {
        return {
            id: row.id,
            code: row.code,
            label: row.label,
            isActive: row.is_active,
            sortOrder: row.sort_order,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    async getCategories(): Promise<CareCategory[]> {
        const pool = getGlobalPool();
        const res = await pool.query('SELECT * FROM public.care_categories ORDER BY sort_order ASC, label ASC');
        return res.rows.map(this.mapRow);
    }

    async getCategoryById(id: string): Promise<CareCategory | null> {
        const pool = getGlobalPool();
        const res = await pool.query('SELECT * FROM public.care_categories WHERE id = $1', [id]);
        return res.rows.length ? this.mapRow(res.rows[0]) : null;
    }

    async createCategory(data: Partial<CareCategory>): Promise<CareCategory> {
        const pool = getGlobalPool();
        const id = uuidv4();
        const res = await pool.query(`
            INSERT INTO public.care_categories (id, code, label, is_active, sort_order)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [id, data.code, data.label, data.isActive !== false, data.sortOrder || 0]);
        return this.mapRow(res.rows[0]);
    }

    async updateCategory(id: string, data: Partial<CareCategory>): Promise<CareCategory> {
        const pool = getGlobalPool();
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (data.code !== undefined) {
            updates.push(`code = $${idx++}`);
            values.push(data.code);
        }
        if (data.label !== undefined) {
            updates.push(`label = $${idx++}`);
            values.push(data.label);
        }
        if (data.isActive !== undefined) {
            updates.push(`is_active = $${idx++}`);
            values.push(data.isActive);
        }
        if (data.sortOrder !== undefined) {
            updates.push(`sort_order = $${idx++}`);
            values.push(data.sortOrder);
        }

        if (updates.length === 0) {
            throw new Error('No fields to update');
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);
        
        const res = await pool.query(`
            UPDATE public.care_categories 
            SET ${updates.join(', ')} 
            WHERE id = $${idx} 
            RETURNING *
        `, values);

        if (res.rows.length === 0) throw new Error('Category not found');
        return this.mapRow(res.rows[0]);
    }
}

export const globalCareCategoryService = new GlobalCareCategoryService();
