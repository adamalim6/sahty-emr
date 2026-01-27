
import { globalQuery, globalQueryOne } from '../db/globalPg';
import { PharmacySupplier } from '../models/pharmacy';

export class GlobalSupplierService {
    
    public async getAll(): Promise<PharmacySupplier[]> {
        const rows = await globalQuery('SELECT * FROM global_suppliers');
        return rows.map(s => ({
            id: s.id,
            name: s.name,
            isActive: s.is_active === true || s.is_active === 1,
            source: 'GLOBAL' as const,
            createdAt: new Date(s.created_at),
            updatedAt: new Date(s.created_at)
        }));
    }

    public async getById(id: string): Promise<PharmacySupplier | undefined> {
        const row = await globalQueryOne('SELECT * FROM global_suppliers WHERE id = $1', [id]);
        
        if (!row) return undefined;
        return {
            id: row.id,
            name: row.name,
            isActive: row.is_active === true || row.is_active === 1,
            source: 'GLOBAL' as const,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.created_at)
        };
    }

    public async create(data: { name: string, is_active?: boolean }): Promise<PharmacySupplier> {
        const now = new Date();
        const id = `supp_${Date.now()}`;
        
        // Check uniqueness
        const existing = await globalQueryOne('SELECT id FROM global_suppliers WHERE lower(name) = lower($1)', [data.name]);
        if (existing) throw new Error("Un fournisseur avec ce nom existe déjà.");

        await globalQuery(
            'INSERT INTO global_suppliers (id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
            [id, data.name, data.is_active !== false, now.toISOString()]
        );

        return {
            id,
            name: data.name,
            isActive: data.is_active !== false,
            source: 'GLOBAL',
            createdAt: now,
            updatedAt: now
        };
    }

    public async update(id: string, data: { name?: string, is_active?: boolean }): Promise<PharmacySupplier> {
        const current = await this.getById(id);
        if (!current) throw new Error("Supplier not found");

        const name = data.name || current.name;
        const isActive = data.is_active !== undefined ? data.is_active : current.isActive;

        if (data.name && data.name.toLowerCase() !== current.name.toLowerCase()) {
             const existing = await globalQueryOne('SELECT id FROM global_suppliers WHERE lower(name) = lower($1) AND id != $2', [data.name, id]);
             if (existing) throw new Error("Un fournisseur avec ce nom existe déjà.");
        }

        await globalQuery(
            'UPDATE global_suppliers SET name=$1, is_active=$2 WHERE id=$3',
            [name, isActive, id]
        );

        return {
            ...current,
            name,
            isActive,
            updatedAt: new Date()
        };
    }

    public async delete(id: string): Promise<void> {
        await globalQuery('DELETE FROM global_suppliers WHERE id = $1', [id]);
    }

}


export const globalSupplierService = new GlobalSupplierService();
