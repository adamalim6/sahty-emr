
import { TenantStore } from '../utils/tenantStore';

export interface TenantSupplierLink {
    supplierId: string;
    purchasePrice: number;
    margin: number;
    vat: number;
    isActive: boolean;
    isDefault: boolean;
}

export interface TenantProductEntry {
    productId: string; // Foreign Key to Global Product
    enabled: boolean;
    suppliers: TenantSupplierLink[];
    // We could store local overrides like "My Name for this" if strictly needed, but better avoid for now.
}

export interface TenantCatalogData {
    products: TenantProductEntry[];
    suppliers?: TenantSupplier[];
    // Tenant-local suppliers definitions (name, address, etc)
    // If we want to store them here. The plan said 'suppliers: TenantSupplier[]' in catalog or separate.
    // Plan said: backend/data/tenants/<tenantId>/pharmacy_suppliers.json for suppliers.
    // BUT the schema in the prompt step 254 said:
    // interface TenantCatalog { products: TenantProductEntry[]; suppliers: TenantSupplier[]; }
    // Let's stick to the prompt's explicit schema for this file.
}

export interface TenantSupplier {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    source: 'TENANT'; // vs 'GLOBAL'
}

const DEFAULT_CATALOG: TenantCatalogData = {
    products: [],
    // IF we store suppliers here, add them. 
    // Wait, the User Request in Step 241 said: "Tenant suppliers: backend/data/tenants/<tenantId>/pharmacy_suppliers.json"
    // But Step 254 Schema snippet showed them in TenantCatalog?
    // "backend/data/tenants/<tenantId>/pharmacy_catalog.json ... Schema: interface TenantCatalog { products..., suppliers... }"
    // I will put suppliers here as per the LATEST instruction in ID 254.
    // It simplifies data management to have one config file.
    // Wait, step 254 says: "backend/data/tenants/<tenantId>/pharmacy_catalog.json -> Tenant Economic Layer"
    // It doesn't explicitly forbid suppliers being here.
    // Let's include them for atomic config.
};

export class TenantCatalogService {

    private getStore(tenantId: string): TenantStore {
        return new TenantStore(tenantId);
    }

    private loadData(tenantId: string): TenantCatalogData {
        // We'll use a type-safe load. If suppliers are separate in reality, we might need 2 loads?
        // Let's assume one file 'pharmacy_catalog.json' handles both as per schema.
        return this.getStore(tenantId).load<TenantCatalogData>('pharmacy_catalog', { products: [] });
    }

    private saveData(tenantId: string, data: TenantCatalogData) {
        this.getStore(tenantId).save('pharmacy_catalog', data);
    }

    // --- PRODUCTS CONFIG ---

    public getCatalogConfig(tenantId: string): TenantProductEntry[] {
        return this.loadData(tenantId).products;
    }

    public getProductConfig(tenantId: string, productId: string): TenantProductEntry | undefined {
        return this.loadData(tenantId).products.find(p => p.productId === productId);
    }

    public upsertProductConfig(tenantId: string, entry: TenantProductEntry): void {
        const data = this.loadData(tenantId);
        const idx = data.products.findIndex(p => p.productId === entry.productId);
        
        if (idx !== -1) {
            data.products[idx] = entry;
        } else {
            data.products.push(entry);
        }
        this.saveData(tenantId, data);
    }

    public toggleProduct(tenantId: string, productId: string, enabled: boolean): void {
        const data = this.loadData(tenantId);
        const product = data.products.find(p => p.productId === productId);
        if (product) {
            product.enabled = enabled;
            this.saveData(tenantId, data);
        } else {
            // Initialize if not exists?
            this.upsertProductConfig(tenantId, {
                productId,
                enabled,
                suppliers: []
            });
        }
    }

    // --- SUPPLIERS CONFIG ---

    public getSuppliers(tenantId: string): TenantSupplier[] {
        const data = this.loadData(tenantId);
        // Ensure compatibility if suppliers array is missing in old files (though we're starting fresh)
        return (data.suppliers || []).map(s => ({ ...s, source: 'TENANT' as const })); 
    }

    public addSupplier(tenantId: string, supplier: TenantSupplier): TenantSupplier {
        const data = this.loadData(tenantId);
        if (!data.suppliers) data.suppliers = [];
        
        supplier.source = 'TENANT';
        data.suppliers.push(supplier);
        this.saveData(tenantId, data);
        return supplier;
    }

    public updateSupplier(tenantId: string, supplier: TenantSupplier): TenantSupplier {
        const data = this.loadData(tenantId);
        if (!data.suppliers) return supplier;

        const idx = data.suppliers.findIndex(s => s.id === supplier.id);
        if (idx !== -1) {
            data.suppliers[idx] = { ...data.suppliers[idx], ...supplier, source: 'TENANT' };
            this.saveData(tenantId, data);
            return data.suppliers[idx];
        }
        throw new Error("Supplier not found");
    }

    public deleteSupplier(tenantId: string, supplierId: string): void {
        const data = this.loadData(tenantId);
        if (data.suppliers) {
            data.suppliers = data.suppliers.filter(s => s.id !== supplierId);
            this.saveData(tenantId, data);
        }
    }
}

export const tenantCatalogService = new TenantCatalogService();
