import { globalQuery, globalQueryOne } from '../db/globalPg';

export interface DCI {
    id: string;
    name: string;
    atcCode?: string;
    synonyms?: string[];
    therapeuticClass?: string;
    createdAt: string;
    updatedAt: string;
}

export class GlobalDCIService {
    
    public async getAllDCIs(): Promise<DCI[]> {
        const rows = await globalQuery('SELECT * FROM global_dci');
        return rows.map(r => this.mapDCI(r));
    }

    private mapDCI(r: any): DCI {
        return {
            id: r.id,
            name: r.name,
            atcCode: r.atc_code,
            therapeuticClass: r.therapeutic_class,
            synonyms: r.synonyms ? (typeof r.synonyms === 'string' ? JSON.parse(r.synonyms) : r.synonyms) : [],
            createdAt: r.created_at,
            updatedAt: r.created_at
        };
    }

    public async getDCIById(id: string): Promise<DCI | undefined> {
        const row = await globalQueryOne('SELECT * FROM global_dci WHERE id = $1', [id]);
        return row ? this.mapDCI(row) : undefined;
    }

    private normalizeName(name: string): string {
        return name.trim().replace(/\s+/g, ' ');
    }

    public async createDCI(data: Omit<DCI, 'id' | 'createdAt' | 'updatedAt'>): Promise<DCI> {
        const normalizedName = this.normalizeName(data.name);

        // Check Duplicate
        const existing = await globalQueryOne('SELECT id FROM global_dci WHERE lower(name) = lower($1)', [normalizedName]);
        if (existing) {
             throw new Error(`Une DCI avec le nom "${normalizedName}" existe déjà.`);
        }

        const newId = `DCI_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const now = new Date().toISOString();

        await globalQuery(`
            INSERT INTO global_dci (id, name, atc_code, therapeutic_class, synonyms, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            newId, 
            normalizedName, 
            data.atcCode?.trim() || null, 
            data.therapeuticClass?.trim() || null, 
            JSON.stringify(data.synonyms?.map(s => s.trim()).filter(s => s.length > 0) || []),
            now
        ]);

        this.invalidateCache();
        return {
            id: newId,
            name: normalizedName,
            atcCode: data.atcCode?.trim(),
            synonyms: data.synonyms,
            therapeuticClass: data.therapeuticClass,
            createdAt: now,
            updatedAt: now
        };
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

        const atcCode = updates.atcCode !== undefined ? updates.atcCode.trim() : current.atcCode;
        const therapeuticClass = updates.therapeuticClass !== undefined ? updates.therapeuticClass.trim() : current.therapeuticClass;
        const synonyms = updates.synonyms ? updates.synonyms.map(s => s.trim()).filter(s => s.length > 0) : current.synonyms;

        await globalQuery(`
            UPDATE global_dci 
            SET name=$1, atc_code=$2, therapeutic_class=$3, synonyms=$4
            WHERE id=$5
        `, [normalizedName, atcCode || null, therapeuticClass || null, JSON.stringify(synonyms), id]);

        this.invalidateCache();
        return {
            ...current,
            name: normalizedName,
            atcCode: atcCode,
            therapeuticClass: therapeuticClass,
            synonyms: synonyms,
            updatedAt: new Date().toISOString()
        };
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
