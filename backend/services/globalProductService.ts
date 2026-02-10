
import { randomUUID } from 'crypto';
import { globalQuery, globalQueryOne, globalTransaction } from '../db/globalPg';
import { globalDCIService } from './GlobalDCIService';

export interface GlobalProductDefinition {
    id: string;
    code: string;
    name: string;
    type: 'Médicament' | 'Consommable' | 'Dispositif Médical';
    dciComposition?: any[];
    therapeuticClass?: string;
    isSubdivisable: boolean;
    unit?: string;
    unitsPerBox?: number;
    sahtyCode?: string;
    brandName?: string;
    manufacturer?: string;
    form?: string;
    presentation?: string;
    marketInfo?: {
        ppv?: number;
        ph?: number;
        pfht?: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

export class GlobalProductService {
    
    public async getAllProducts(): Promise<GlobalProductDefinition[]> {
        const rows = await globalQuery('SELECT * FROM global_products');
        return rows.map(r => this.mapProduct(r));
    }

    private mapProduct(r: any): GlobalProductDefinition {
        return {
            id: r.id,
            code: r.code,
            name: r.name,
            type: r.type,
            form: r.form,
            presentation: r.presentation,
            dciComposition: r.dci_composition ? (typeof r.dci_composition === 'string' ? JSON.parse(r.dci_composition) : r.dci_composition) : [],
            therapeuticClass: r.class_therapeutique,
            isSubdivisable: false,
            unit: 'Boîte',
            unitsPerBox: r.units_per_pack,
            sahtyCode: r.sahty_code,
            brandName: r.name,
            manufacturer: r.manufacturer,
            marketInfo: {
                ppv: r.ppv ? parseFloat(r.ppv) : undefined,
                ph: r.ph ? parseFloat(r.ph) : undefined,
                pfht: r.pfht ? parseFloat(r.pfht) : undefined
            },
            createdAt: new Date(r.created_at),
            updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(r.created_at)
        };
    }

    public async getProductById(id: string): Promise<GlobalProductDefinition | undefined> {
        const row = await globalQueryOne('SELECT * FROM global_products WHERE id = $1', [id]);
        return row ? this.mapProduct(row) : undefined;
    }

    private validateProduct(product: Partial<GlobalProductDefinition>) {
        if (product.type === 'Médicament') {
            if (!product.dciComposition || product.dciComposition.length === 0) {
                // Relaxed validation for legacy data
            }
        }
    }

    public async createProduct(product: GlobalProductDefinition): Promise<GlobalProductDefinition> {
        this.validateProduct(product);
        
        const newProduct = { ...product };
        if (!newProduct.id) {
            newProduct.id = randomUUID();
        }

        // Auto-generate Sahty Code if missing
        if (!newProduct.sahtyCode) {
            // SAH- + 6 digits
            const suffix = Math.floor(100000 + Math.random() * 900000); // 100000-999999
            newProduct.sahtyCode = `SAH-${suffix}`;
        }

        const existing = await globalQueryOne('SELECT id FROM global_products WHERE id = $1', [newProduct.id]);
        if (existing) {
            throw new Error(`Product ID ${newProduct.id} already exists`);
        }

        const now = new Date();
        
        await globalQuery(`
            INSERT INTO global_products (
                id, code, name, type, form, presentation, dci_composition, class_therapeutique, 
                units_per_pack, sahty_code, manufacturer, 
                ppv, ph, pfht, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
        `, [
            newProduct.id, newProduct.code || '', newProduct.name, newProduct.type, newProduct.form, newProduct.presentation,
            JSON.stringify(newProduct.dciComposition || []), newProduct.therapeuticClass,
            newProduct.unitsPerBox, newProduct.sahtyCode, newProduct.manufacturer,
            newProduct.marketInfo?.ppv, newProduct.marketInfo?.ph, newProduct.marketInfo?.pfht,
            now.toISOString()
        ]);

        return {
            ...newProduct,
            createdAt: now,
            updatedAt: now
        };
    }

    public async updateProduct(id: string, updates: Partial<GlobalProductDefinition>): Promise<GlobalProductDefinition> {
        return globalTransaction(async (client) => {
            const currentResult = await client.query('SELECT * FROM global_products WHERE id = $1', [id]);
            if (currentResult.rows.length === 0) {
                throw new Error("Product not found");
            }
            const current = this.mapProduct(currentResult.rows[0]);

            const mergedProduct = { ...current, ...updates };
            this.validateProduct(mergedProduct);

            const now = new Date();
            
            // Check for Price Change
            const ppvChanged = mergedProduct.marketInfo?.ppv !== current.marketInfo?.ppv;
            const phChanged = mergedProduct.marketInfo?.ph !== current.marketInfo?.ph;
            const pfhtChanged = mergedProduct.marketInfo?.pfht !== current.marketInfo?.pfht;

            if (ppvChanged || phChanged || pfhtChanged) {
                // Archive Old Price
                const historyId = randomUUID();
                await client.query(`
                    INSERT INTO global_product_price_history (
                        id, product_id, ppv, ph, pfht, valid_from, valid_to
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    historyId, id, 
                    current.marketInfo?.ppv, current.marketInfo?.ph, current.marketInfo?.pfht,
                    current.updatedAt.toISOString(), now.toISOString()
                ]);
            }
            
            await client.query(`
                UPDATE global_products SET 
                    code=$1, name=$2, type=$3, form=$4, presentation=$5, dci_composition=$6, class_therapeutique=$7, 
                    units_per_pack=$8, sahty_code=$9, manufacturer=$10, 
                    ppv=$11, ph=$12, pfht=$13, updated_at=$14
                WHERE id=$15
            `, [
                mergedProduct.code || '', mergedProduct.name, mergedProduct.type, mergedProduct.form, mergedProduct.presentation,
                JSON.stringify(mergedProduct.dciComposition || []), mergedProduct.therapeuticClass,
                mergedProduct.unitsPerBox, mergedProduct.sahtyCode, mergedProduct.manufacturer,
                mergedProduct.marketInfo?.ppv, mergedProduct.marketInfo?.ph, mergedProduct.marketInfo?.pfht,
                now.toISOString(),
                id
            ]);
            
            // Post-update Propagation for Moroccan PH rule
            if ((phChanged || pfhtChanged) && mergedProduct.type === 'Médicament' && mergedProduct.marketInfo?.ph) {
                // Get all tenants from clients table in global DB
                const tenantsResult = await client.query('SELECT id FROM tenants');
                const tenants = tenantsResult.rows;
                
                for (const tenant of tenants) {
                    try {
                        const { tenantCatalogService } = require('./tenantCatalogService');
                        await tenantCatalogService.applyRegulatoryUpdate(tenant.id, id, mergedProduct.marketInfo.ph, mergedProduct.marketInfo.pfht);
                    } catch (e) {
                        console.error(`Failed to propagate price to tenant ${tenant.id}`, e);
                    }
                }
            }

            return {
                ...mergedProduct,
                updatedAt: now
            };
        });
    }

    public async deleteProduct(id: string): Promise<void> {
        await globalQuery('DELETE FROM global_products WHERE id = $1', [id]);
    }

    public async getProductsPaginated(page: number, limit: number, query: string = '', idsFilter?: string[]): Promise<{ data: GlobalProductDefinition[], total: number, page: number, totalPages: number }> {
        let sql = 'SELECT * FROM global_products';
        let countSql = 'SELECT count(*) as c FROM global_products';
        const params: any[] = [];
        const conditions: string[] = [];
        let paramIndex = 1;

        if (idsFilter && idsFilter.length > 0) {
            conditions.push(`id = ANY($${paramIndex++})`);
            params.push(idsFilter);
        }

        if (query && query.trim().length > 0) {
            const q = `%${query.trim().toLowerCase()}%`;
            conditions.push(`(lower(name) LIKE $${paramIndex} OR lower(sahty_code) LIKE $${paramIndex} OR lower(manufacturer) LIKE $${paramIndex})`);
            params.push(q);
            paramIndex++;
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            sql += whereClause;
            countSql += whereClause;
        }

        const countParams = [...params];
        console.log(`[GlobalProductService] Executing countSql: ${countSql}`);
        console.log(`[GlobalProductService] countParams: ${JSON.stringify(countParams)}`);
        const countRes = await globalQueryOne<any>(countSql, countParams);
        const total = parseInt(countRes?.c || '0');
        const totalPages = Math.ceil(total / limit);

        sql += ` ORDER BY name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, (page - 1) * limit);

        console.log(`[GlobalProductService] Executing sql: ${sql}`);
        console.log(`[GlobalProductService] params: ${JSON.stringify(params)}`);
        const rows = await globalQuery(sql, params);
        console.log(`[GlobalProductService] Got ${rows.length} rows`);

        
        const dciIds = new Set<string>();
        const products = rows.map(r => this.mapProduct(r));
        
        products.forEach(p => {
            p.dciComposition?.forEach((c: any) => {
                if (c.dciId) dciIds.add(c.dciId);
            });
        });

        const allDCIs = await globalDCIService.getAllDCIs();
        const dciMap = new Map<string, any>(allDCIs.map((d: any) => [d.id, d]));

        const enriched = products.map(p => ({
            ...p,
            dciComposition: p.dciComposition?.map((comp: any) => {
                const dci = dciMap.get(comp.dciId);
                const dciAtc = dci ? (dci.atcCode || dci.atc_code) : undefined;
                return {
                    ...comp,
                    name: dci ? dci.name : 'Inconnu',
                    atcCode: dciAtc ?? comp.atcCode
                };
            })
        }));

        return {
            data: enriched,
            total,
            page,
            totalPages
        };
    }

    public async getProductPriceHistory(productId: string): Promise<any[]> {
        const rows = await globalQuery(`
            SELECT * FROM global_product_price_history 
            WHERE product_id = $1 
            ORDER BY valid_from DESC
        `, [productId]);
        
        return rows.map(r => ({
            id: r.id,
            productId: r.product_id,
            ppv: r.ppv ? parseFloat(r.ppv) : undefined,
            ph: r.ph ? parseFloat(r.ph) : undefined,
            pfht: r.pfht ? parseFloat(r.pfht) : undefined,
            validFrom: r.valid_from,
            validTo: r.valid_to
        }));
    }
}


export const globalProductService = new GlobalProductService();
