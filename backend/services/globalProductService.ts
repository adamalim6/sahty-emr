
import { randomUUID } from 'crypto';
import { TenantStore } from '../utils/tenantStore';
import { ProductDefinition, ProductDCI } from '../models/pharmacy';

// We reuse ProductDefinition but we will strictly ignore pricing fields in this service
// or define a cleaner GlobalProductDefinition type if needed.
// For now, let's strictly operate on the metadata subset.

export interface GlobalProductDefinition {
    id: string;
    code: string;
    name: string;
    type: 'MEDICAMENT' | 'CONSOMMABLE' | 'DISPOSITIF_MEDICAL';
    dosage?: number;
    dosageUnit?: string;
    dciComposition?: ProductDCI[]; // Updated to support dosage per DCI
    dciIds?: never; // Deprecated
    molecules?: never; // DEPRECATED/REMOVED
    therapeuticClass?: string;
    isSubdivisable: boolean;
    unitsPerPack?: number;
    // No suppliers, no prices here
    createdAt: Date;
    updatedAt: Date;
}

export class GlobalProductService {
    
    private get store() {
        return require('../utils/tenantStore').GlobalStore; 
    }

    public getAllProducts(): GlobalProductDefinition[] {
        return this.store.load('products', []);
    }

    public getProductById(id: string): GlobalProductDefinition | undefined {
        const products = this.getAllProducts();
        return products.find(p => p.id === id);
    }

    private validateProduct(product: Partial<GlobalProductDefinition>) {
        // Enforce strict DCI requirement for Drugs
        if (product.type === 'MEDICAMENT') {
            if (!product.dciComposition || product.dciComposition.length === 0) {
                throw new Error("DCI obligatoire pour un médicament");
            }
            // Validate dosages
            for(const dci of product.dciComposition) {
                if(!dci.dosage || dci.dosage <= 0) {
                    throw new Error("Le dosage doit être défini pour chaque DCI");
                }
            }
        }
    }

    public createProduct(product: GlobalProductDefinition): GlobalProductDefinition {
        this.validateProduct(product);

        const products = this.getAllProducts();
        
        // Generate ID if missing
        const newProduct = { ...product };
        if (!newProduct.id) {
            newProduct.id = randomUUID();
        }

        if (products.find(p => p.id === newProduct.id)) {
            throw new Error(`Product ID ${newProduct.id} already exists`);
        }
        // Enforce safe defaults/cleaning
        const cleanProduct: GlobalProductDefinition = {
            ...newProduct,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        products.push(cleanProduct);
        this.saveProducts(products);
        return cleanProduct;
    }

    public updateProduct(id: string, updates: Partial<GlobalProductDefinition>): GlobalProductDefinition {
        const products = this.getAllProducts();
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) throw new Error("Product not found");

        const mergedProduct = { ...products[idx], ...updates };
        this.validateProduct(mergedProduct);

        const updated = { ...mergedProduct, updatedAt: new Date() };
        // Prevent ID change
        updated.id = id; 
        
        products[idx] = updated;
        this.saveProducts(products);
        return updated;
    }

    public deleteProduct(id: string): void {
        let products = this.getAllProducts();
        products = products.filter(p => p.id !== id);
        this.saveProducts(products);
    }

    private saveProducts(products: GlobalProductDefinition[]) {
        this.store.save('products', products);
    }
}

export const globalProductService = new GlobalProductService();
