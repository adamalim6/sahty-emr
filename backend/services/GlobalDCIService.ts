import { globalQuery, globalQueryOne } from '../db/globalPg';

export interface DCI {
    id: string;
    name: string;
    atcCode?: string;
    synonyms?: { id: string; synonym: string }[];
    therapeuticClass?: string;
    careCategoryId?: string;
    createdAt: string;
    updatedAt: string;
}

export class GlobalDCIService {
    
    public async getAllDCIs(): Promise<DCI[]> {
        const rows = await globalQuery('SELECT * FROM global_dci');
        const syncRes = await globalQuery('SELECT id, dci_id, synonym FROM dci_synonyms');
        
        const synonymsMap = new Map<string, { id: string; synonym: string }[]>();
        for (const row of syncRes) {
            if (!synonymsMap.has(row.dci_id)) synonymsMap.set(row.dci_id, []);
            synonymsMap.get(row.dci_id)!.push({ id: row.id, synonym: row.synonym });
        }

        return rows.map(r => this.mapDCI(r, synonymsMap.get(r.id) || []));
    }

    private mapDCI(r: any, synonyms: { id: string; synonym: string }[] = []): DCI {
        return {
            id: r.id,
            name: r.name,
            atcCode: r.atc_code,
            therapeuticClass: r.therapeutic_class,
            careCategoryId: r.care_category_id,
            synonyms: synonyms,
            createdAt: r.created_at,
            updatedAt: r.created_at
        };
    }

    public async getDCIById(id: string): Promise<DCI | undefined> {
        const row = await globalQueryOne('SELECT * FROM global_dci WHERE id = $1', [id]);
        if (!row) return undefined;
        const syncRes = await globalQuery('SELECT id, synonym FROM dci_synonyms WHERE dci_id = $1', [id]);
        return this.mapDCI(row, syncRes);
    }

    private normalizeName(name: string): string {
        return name.trim().replace(/\s+/g, ' ');
    }

    public async createDCI(data: Omit<DCI, 'id' | 'createdAt' | 'updatedAt'>): Promise<DCI> {
        const normalizedName = this.normalizeName(data.name);

        const existing = await globalQueryOne('SELECT id FROM global_dci WHERE lower(name) = lower($1)', [normalizedName]);
        if (existing) {
             throw new Error(`Une DCI avec le nom "${normalizedName}" existe déjà.`);
        }

        const newId = `DCI_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const now = new Date().toISOString();

        await globalQuery('BEGIN');
        try {
            await globalQuery(`
                INSERT INTO global_dci (id, name, atc_code, therapeutic_class, care_category_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                newId, 
                normalizedName, 
                data.atcCode?.trim() || null, 
                data.therapeuticClass?.trim() || null, 
                data.careCategoryId || null,
                now
            ]);

            const newSynonyms = [];
            if (data.synonyms && data.synonyms.length > 0) {
                for (const syn of data.synonyms) {
                    const text = typeof syn === 'string' ? syn : syn.synonym;
                    if (text && text.trim().length > 0) {
                        const synRes = await globalQuery(`
                            INSERT INTO dci_synonyms (dci_id, synonym, created_at)
                            VALUES ($1, $2, $3) RETURNING id, synonym
                        `, [newId, text.trim(), now]);
                        newSynonyms.push(synRes[0]);
                    }
                }
            }

            await globalQuery('COMMIT');
            this.invalidateCache();
            return {
                id: newId,
                name: normalizedName,
                atcCode: data.atcCode?.trim(),
                synonyms: newSynonyms,
                therapeuticClass: data.therapeuticClass,
                careCategoryId: data.careCategoryId,
                createdAt: now,
                updatedAt: now
            };
        } catch (e) {
            await globalQuery('ROLLBACK');
            throw e;
        }
    }

    public async updateDCI(id: string, updates: Partial<Omit<DCI, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DCI> {
        const current = await this.getDCIById(id);
        if (!current) throw new Error("DCI non trouvée");

        let normalizedName = current.name;
        if (updates.name) {
            normalizedName = this.normalizeName(updates.name);
            if (normalizedName.toLowerCase() !== current.name.toLowerCase()) {
                const existing = await globalQueryOne('SELECT id FROM global_dci WHERE lower(name) = lower($1) AND id != $2', [normalizedName, id]);
                if (existing) throw new Error(`Une DCI avec le nom "${normalizedName}" existe déjà.`);
            }
        }

        const atcCode = updates.atcCode !== undefined ? updates.atcCode?.trim() : current.atcCode;
        const therapeuticClass = updates.therapeuticClass !== undefined ? updates.therapeuticClass?.trim() : current.therapeuticClass;
        const careCategoryId = updates.careCategoryId !== undefined ? updates.careCategoryId : current.careCategoryId;
        
        await globalQuery('BEGIN');
        try {
            await globalQuery(`
                UPDATE global_dci 
                SET name=$1, atc_code=$2, therapeutic_class=$3, care_category_id=$4
                WHERE id=$5
            `, [normalizedName, atcCode || null, therapeuticClass || null, careCategoryId || null, id]);

            let newSynonyms = current.synonyms || [];
            if (updates.synonyms !== undefined) {
                await globalQuery('DELETE FROM dci_synonyms WHERE dci_id = $1', [id]);
                newSynonyms = [];
                const now = new Date().toISOString();
                for (const syn of updates.synonyms) {
                    const text = typeof syn === 'string' ? syn : syn.synonym;
                    if (text && text.trim().length > 0) {
                        const synRes = await globalQuery(`
                            INSERT INTO dci_synonyms (dci_id, synonym, created_at)
                            VALUES ($1, $2, $3) RETURNING id, synonym
                        `, [id, text.trim(), now]);
                        newSynonyms.push(synRes[0]);
                    }
                }
            }

            await globalQuery('COMMIT');
            this.invalidateCache();
            return {
                ...current,
                name: normalizedName,
                atcCode: atcCode,
                therapeuticClass: therapeuticClass,
                careCategoryId: careCategoryId,
                synonyms: newSynonyms,
                updatedAt: new Date().toISOString()
            };
        } catch (e) {
            await globalQuery('ROLLBACK');
            throw e;
        }
    }

    public async deleteDCI(id: string): Promise<void> {
        await globalQuery('DELETE FROM global_dci WHERE id = $1', [id]);
        this.invalidateCache();
    }

    private dciCache: DCI[] | null = null;

    private async ensureCache(): Promise<DCI[]> {
        if (!this.dciCache) {
            this.dciCache = await this.getAllDCIs();
        }
        return this.dciCache;
    }

    public invalidateCache() {
        this.dciCache = null;
    }

    public async getDCIsPaginated(page: number, limit: number, query: string = ''): Promise<{ data: DCI[], total: number, page: number, totalPages: number }> {
        // In-memory fuzzy search for better UX (accents, case, etc.)
        const allDCIs = await this.ensureCache();
        
        let filtered = allDCIs;
        if (query) {
            const normalizedQuery = this.normalizeString(query);
            filtered = allDCIs.filter(dci => {
                const normName = this.normalizeString(dci.name);
                const normAtc = dci.atcCode ? this.normalizeString(dci.atcCode) : '';
                return normName.includes(normalizedQuery) || normAtc.includes(normalizedQuery);
            });
        }

        const total = filtered.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const pagedData = filtered.slice(offset, offset + limit);

        return {
            data: pagedData,
            total,
            page,
            totalPages
        };
    }

    private normalizeString(str: string): string {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }
}

export const globalDCIService = new GlobalDCIService();
