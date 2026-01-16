
import { TenantStore } from '../utils/tenantStore';
import { PharmacySupplier } from '../models/pharmacy';

export class GlobalSupplierService {
    
    private get store() {
        return require('../utils/tenantStore').GlobalStore; 
    }

    public getAll(): PharmacySupplier[] {
        // We load from 'suppliers' (normalized to global/suppliers.json)
        // Ensure we map them to PharmacySupplier and force source='GLOBAL'
        const raw = this.store.load('suppliers', []);
        return raw.map((s: any) => ({ ...s, source: 'GLOBAL' }));
    }

    public getById(id: string): PharmacySupplier | undefined {
        return this.getAll().find(s => s.id === id);
    }

    // Read-only for now via this service, assuming SuperAdmin manages them elsewhere 
    // or we add create/update methods if needed later.
}

export const globalSupplierService = new GlobalSupplierService();
