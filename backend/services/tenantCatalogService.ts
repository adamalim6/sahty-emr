
import { TenantStore } from '../utils/tenantStore';
import { randomUUID } from 'crypto';

export interface PriceVersion {
    id: string; // "versionId"
    purchasePrice: number;
    margin: number;
    vat: number;
    salePriceHT: number;
    salePriceTTC: number;
    validFrom: string; // ISO Date
    validTo: string | null; // ISO Date or null if active
    createdBy?: string;
    reason?: string;
}

export interface TenantSupplierLink {
    supplierId: string;
    isActive: boolean;
    isDefault: boolean;
    priceVersions: PriceVersion[];
}

export interface TenantProductEntry {
    productId: string; // Foreign Key to Global Product
    enabled: boolean;
    suppliers: TenantSupplierLink[];
}

export interface TenantSupplier {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    source: 'TENANT';
}

export interface TenantCatalogData {
    products: TenantProductEntry[];
}

export interface TenantSuppliersData {
    suppliers: TenantSupplier[];
}

const DEFAULT_CATALOG: TenantCatalogData = {
    products: []
};

const DEFAULT_SUPPLIERS: TenantSuppliersData = {
    suppliers: []
};

export class TenantCatalogService {

    private getStore(tenantId: string): TenantStore {
        return new TenantStore(tenantId);
    }

    private loadCatalog(tenantId: string): TenantCatalogData {
        return this.getStore(tenantId).load<TenantCatalogData>('pharmacy_catalog', DEFAULT_CATALOG);
    }

    private saveCatalog(tenantId: string, data: TenantCatalogData) {
        this.getStore(tenantId).save('pharmacy_catalog', data);
    }

    private loadSuppliersData(tenantId: string): TenantSuppliersData {
        return this.getStore(tenantId).load<TenantSuppliersData>('suppliers', DEFAULT_SUPPLIERS);
    }

    private saveSuppliersData(tenantId: string, data: TenantSuppliersData) {
        this.getStore(tenantId).save('suppliers', data);
    }

    // --- PRODUCTS CONFIG ---

    public getCatalogConfig(tenantId: string): TenantProductEntry[] {
        return this.loadCatalog(tenantId).products;
    }

    public getProductConfig(tenantId: string, productId: string): TenantProductEntry | undefined {
        return this.loadCatalog(tenantId).products.find(p => p.productId === productId);
    }

    /**
     * upsertProductConfig
     * Takes a partial or full product definition + target suppliers state.
     * Logically detects price changes and versions accordingly.
     */
    /**
     * upsertProductConfig
     * Takes a partial or full product definition + target suppliers state.
     * Logically detects price changes and versions accordingly.
     */
    public upsertProductConfig(tenantId: string, entry: TenantProductEntry, context?: { userId?: string, reason?: string }): void {
        const data = this.loadCatalog(tenantId);
        
        let idx = data.products.findIndex(p => p.productId === entry.productId);
        let currentConfig: TenantProductEntry;

        if (idx !== -1) {
            currentConfig = data.products[idx];
        } else {
            currentConfig = { productId: entry.productId, enabled: entry.enabled, suppliers: [] };
            data.products.push(currentConfig);
            idx = data.products.length - 1;
        }

        // ENTRY SUPPLIERS MAPPING
        // The frontend will send a structure. 
        // We iterate over the INCOMING suppliers (entry.suppliers)
        
        const updatedSuppliers: TenantSupplierLink[] = entry.suppliers.map((inputLink: any) => {
            const existingLink = currentConfig.suppliers.find(s => s.supplierId === inputLink.supplierId);
            
            let versions = existingLink ? [...(existingLink.priceVersions || [])] : [];
            const activeVer = versions.find(v => v.validTo === null);

            // Access flat fields from input (assuming frontend serves them as flat fields on the supplier object)
            // If the inputLink already has a nested structure (from a previous load and re-save without edits),
            // we should be careful. But strictly, the "save" action comes from form data where fields are flat.
            // If fields are missing in inputLink, we keep existing active value.
            
            const newPrice = inputLink.purchasePrice ?? activeVer?.purchasePrice ?? 0;
            const newMargin = inputLink.margin ?? activeVer?.margin ?? 0;
            const newVat = inputLink.vat ?? activeVer?.vat ?? 0;
            
            // Check for change
            // We only create version if there was an active version OR if this is the first one.
            const hasPriceChanged = !activeVer ||
                activeVer.purchasePrice !== newPrice ||
                activeVer.margin !== newMargin ||
                activeVer.vat !== newVat;

            if (hasPriceChanged) {
                const now = new Date().toISOString();
                if (activeVer) activeVer.validTo = now;

                const salePriceHT = newPrice * (1 + newMargin / 100);
                const salePriceTTC = salePriceHT * (1 + newVat / 100);

                versions.push({
                    id: randomUUID(),
                    purchasePrice: newPrice,
                    margin: newMargin,
                    vat: newVat,
                    salePriceHT,
                    salePriceTTC,
                    validFrom: now,
                    validTo: null,
                    createdBy: context?.userId,
                    reason: context?.reason
                });
            }

            return {
                supplierId: inputLink.supplierId,
                isActive: inputLink.isActive,
                isDefault: inputLink.isDefault,
                priceVersions: versions
            };
        });

        data.products[idx].enabled = entry.enabled;
        data.products[idx].suppliers = updatedSuppliers;

        this.saveCatalog(tenantId, data);
    }

    public toggleProduct(tenantId: string, productId: string, enabled: boolean): void {
        const data = this.loadCatalog(tenantId);
        const product = data.products.find(p => p.productId === productId);
        if (product) {
            product.enabled = enabled;
            this.saveCatalog(tenantId, data);
        } else {
             const newEntry: TenantProductEntry = {
                productId,
                enabled,
                suppliers: []
            };
            data.products.push(newEntry);
            this.saveCatalog(tenantId, data);
        }
    }

    // --- SUPPLIERS CONFIG ---

    public getSuppliers(tenantId: string): TenantSupplier[] {
        const data = this.loadSuppliersData(tenantId);
        return (data.suppliers || []).map(s => ({ ...s, source: 'TENANT' as const })); 
    }

    public addSupplier(tenantId: string, supplier: TenantSupplier): TenantSupplier {
        const data = this.loadSuppliersData(tenantId);
        if (!data.suppliers) data.suppliers = [];
        
        supplier.source = 'TENANT';
        data.suppliers.push(supplier);
        this.saveSuppliersData(tenantId, data);
        return supplier;
    }

    public updateSupplier(tenantId: string, supplier: TenantSupplier): TenantSupplier {
        const data = this.loadSuppliersData(tenantId);
        if (!data.suppliers) return supplier;

        const idx = data.suppliers.findIndex(s => s.id === supplier.id);
        if (idx !== -1) {
            data.suppliers[idx] = { ...data.suppliers[idx], ...supplier, source: 'TENANT' };
            this.saveSuppliersData(tenantId, data);
            return data.suppliers[idx];
        }
        throw new Error("Supplier not found");
    }

    public deleteSupplier(tenantId: string, supplierId: string): void {
        const data = this.loadSuppliersData(tenantId);
        if (data.suppliers) {
            data.suppliers = data.suppliers.filter(s => s.id !== supplierId);
            this.saveSuppliersData(tenantId, data);
        }
    }
    public async applyRegulatoryUpdate(tenantId: string, productId: string, newPh: number, newPfht?: number): Promise<void> {
        // Option A: Keep Purchase Fixed, Recalculate Margin.
        // Target: SalePriceTTC = newPh.
        
        const data = this.loadCatalog(tenantId);
        const idx = data.products.findIndex(p => p.productId === productId);
        if (idx === -1) return; // Product not in tenant catalog
        
        const productConfig = data.products[idx];
        if (!productConfig.enabled) return;

        let changed = false;
        
        productConfig.suppliers = productConfig.suppliers.map(link => {
            const versions = link.priceVersions || [];
            const activeVer = versions.find(v => v.validTo === null);
            
            if (!activeVer) return link; // No active version

            // Check if current SalePriceTTC matches New PH
            if (Math.abs(activeVer.salePriceTTC - newPh) < 0.01) return link; // Already synced

            // Perform Calculation Option A
            // SalePriceTTC = Purchase * (1 + Margin) * (1 + Vat)
            // Target: NewPH = ActivePurchase * (1 + NewMargin) * (1 + ActiveVat)
            // (1 + NewMargin) = NewPH / (ActivePurchase * (1 + ActiveVat))
            // NewMargin = (NewPH / (ActivePurchase * (1 + ActiveVat))) - 1
            
            const vatFactor = 1 + (activeVer.vat / 100);
            const purchase = activeVer.purchasePrice;
            
            let newMargin = activeVer.margin;
            
            if (purchase > 0) {
                 const requiredMarginFactor = newPh / (purchase * vatFactor);
                 newMargin = (requiredMarginFactor - 1) * 100;
            } else {
                 // Dangerous edge case: Purchase Price is 0. 
                 // Cannot calculate margin.
                 // Should we update Purchase Price to PFHT? 
                 // If PFHT is provided and logic permits.
                 // For now, skip if purchase is 0 to avoid Infinity.
                 return link;
            }

            // Create New Version
            const now = new Date().toISOString();
            activeVer.validTo = now;

            const newSaleHT = purchase * (1 + newMargin / 100);
            
            versions.push({
                id: randomUUID(),
                purchasePrice: purchase, // OPTION A: Fixed Purchase Price
                margin: newMargin,       // ADAPTIVE Margin
                vat: activeVer.vat,
                salePriceHT: newSaleHT,
                salePriceTTC: newPh,     // LOCKED to PH
                validFrom: now,
                validTo: null,
                createdBy: 'SYSTEM_REGULATION',
                reason: 'Regulatory Update (Global PH)'
            });
            
            changed = true;
            return { ...link, priceVersions: versions };
        });

        if (changed) {
            this.saveCatalog(tenantId, data);
        }
    }
}

export const tenantCatalogService = new TenantCatalogService();

