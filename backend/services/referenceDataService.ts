
import { tenantQuery, tenantQueryOne } from '../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';

export class ReferenceDataService {
    
    // --- Products ---

    async getAllProducts(tenantId: string): Promise<any[]> {
        return tenantQuery(tenantId, 
            'SELECT * FROM reference.global_products ORDER BY name ASC'
        );
    }

    async getProductById(tenantId: string, id: string): Promise<any | null> {
        const row = await tenantQueryOne(tenantId, 
            'SELECT * FROM reference.global_products WHERE id = $1',
            [id]
        );
        if (!row) return null;
        
        // Fetch DCIs for single product
        const dcis = await tenantQuery(tenantId, 'SELECT * FROM reference.global_dci');
        const dciMap = new Map<string, any>(dcis.map((d: any) => [d.id, d]));
        
        return this.mapProduct(row, dciMap);
    }

    async getProductsPaginated(
        tenantId: string, 
        page: number = 1, 
        limit: number = 10, 
        search?: string,
        idsFilter?: string[],
        dciId?: string
    ) {
        const offset = (page - 1) * limit;
        const params: any[] = [];
        let whereClause = 'WHERE 1=1';

        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length} OR sahty_code ILIKE $${params.length})`;
        }

        if (idsFilter && idsFilter.length > 0) {
            // Safe parameter expansion for IDs
            const placeholders = idsFilter.map((_, i) => `$${params.length + i + 1}`).join(',');
            whereClause += ` AND id IN (${placeholders})`;
            params.push(...idsFilter);
        }

        if (dciId) {
            // Use JSONB containment for robust matching
            // We construct a JSON array with one object containing the dciId to look for
            const paramValue = JSON.stringify([{ dciId: dciId }]);
            params.push(paramValue);
            // We explicitly cast to jsonb to ensure the operator works regardless of column type (text/json/jsonb)
             whereClause += ` AND dci_composition::jsonb @> $${params.length}::jsonb`;
        }

        const countQuery = `SELECT COUNT(*) FROM reference.global_products ${whereClause}`;
        const countRes = await tenantQueryOne(tenantId, countQuery, params);
        const total = parseInt(countRes.count);

        params.push(limit);
        params.push(offset);
        
        const query = `
            SELECT * FROM reference.global_products 
            ${whereClause} 
            ORDER BY name ASC 
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `;

        const rows = await tenantQuery(tenantId, query, params);
        
        // Enrich with DCI Data
        // 1. Fetch all DCIs (or optimize to fetch only needed ones)
        // For now, fetch all from reference.global_dci as the table is likely < 10k rows and cached by PG
        const dcis = await tenantQuery(tenantId, 'SELECT * FROM reference.global_dci');
        const dciMap = new Map<string, any>(dcis.map((d: any) => [d.id, d]));

        const data = rows.map(r => this.mapProduct(r, dciMap));

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    // --- DCIs ---

    async getDCIs(tenantId: string, search?: string) {
         let query = 'SELECT * FROM reference.global_dci';
         const params: any[] = [];
         
         if (search) {
             query += ' WHERE name ILIKE $1 OR atc_code ILIKE $1';
             params.push(`%${search}%`);
         }
         
         query += ' ORDER BY name ASC LIMIT 50'; // Limit results for performance
         
         const rows = await tenantQuery(tenantId, query, params);
         return rows.map((r: any) => ({
             id: r.id,
             name: r.name,
             atcCode: r.atc_code,
             therapeuticClass: r.therapeutic_class,
             synonyms: r.synonyms ? (typeof r.synonyms === 'string' ? JSON.parse(r.synonyms) : r.synonyms) : []
         }));
    }

    private mapProduct(r: any, dciMap?: Map<string, any>): any {
        let dciComposition = r.dci_composition;
        if (typeof dciComposition === 'string') {
            try { dciComposition = JSON.parse(dciComposition); } catch (e) {}
        }
        
        if (dciMap && Array.isArray(dciComposition)) {
            dciComposition = dciComposition.map((comp: any) => {
                const dci = dciMap.get(comp.dciId);
                return {
                    ...comp,
                    name: dci ? dci.name : 'Inconnu',
                    atcCode: dci ? dci.atc_code : comp.atcCode
                };
            });
        }

        return {
            id: r.id,
            code: r.code,
            name: r.name,
            type: r.type,
            form: r.form,
            presentation: r.presentation,
            dciComposition: dciComposition || [],
            therapeuticClass: r.class_therapeutique,
            isSubdivisable: false, // Default logic
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
            createdAt: r.created_at,
            updatedAt: r.updated_at
        };
    }

    async getProductPriceHistory(tenantId: string, productId: string) {
        return tenantQuery(tenantId,
            'SELECT * FROM reference.global_product_price_history WHERE product_id = $1 ORDER BY valid_from DESC',
            [productId]
        );
    }

    // --- Suppliers ---

    async getSuppliers(tenantId: string) {
        return tenantQuery(tenantId, 'SELECT * FROM reference.global_suppliers WHERE is_active = TRUE');
    }

    // --- Actes ---
    
    async getGlobalActesPaginated(
        tenantId: string, 
        page: number = 1, 
        limit: number = 50, 
        search?: string
    ) {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM reference.global_actes';
        let countQuery = 'SELECT COUNT(*) FROM reference.global_actes';
        const params: any[] = [];
        let whereClause = ' WHERE 1=1';

        if (search) {
             params.push(`%${search}%`);
             whereClause += ` AND (libelle_sih ILIKE $${params.length} OR code_sih ILIKE $${params.length})`;
        }

        query += whereClause;
        countQuery += whereClause;

        const countRes = await tenantQueryOne(tenantId, countQuery, params);
        const total = parseInt(countRes.count);

        params.push(limit);
        params.push(offset);
        
        query += ` ORDER BY libelle_sih ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const rows = await tenantQuery(tenantId, query, params);
        
        // Map to Acte Model
        const data = rows.map((row: any) => ({
            code: row.code_sih,
            label: row.libelle_sih,
            family: row.famille_sih,
            subFamily: row.sous_famille_sih,
            ngapCode: row.code_ngap,
            ngapLabel: row.libelle_ngap,
            ngapCoeff: row.cotation_ngap,
            ccamCode: row.code_ccam,
            ccamLabel: row.libelle_ccam,
            type: row.type_acte,
            duration: row.duree_moyenne,
            active: row.actif === true || row.actif === 1
        }));

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getGlobalActes(tenantId: string, search?: string) {
         return this.getGlobalActesPaginated(tenantId, 1, 1000, search).then(r => r.data);
    }
}

export const referenceDataService = new ReferenceDataService();
