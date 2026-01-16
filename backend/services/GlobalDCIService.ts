
import { TenantStore } from '../utils/tenantStore';

export interface DCI {
    id: string;
    name: string;              // Unique, case-insensitive, trimmed
    atcCode?: string;
    synonyms?: string[];
    therapeuticClass?: string;
    createdAt: string;
    updatedAt: string;
}

export class GlobalDCIService {
    
    private get store() {
        return require('../utils/tenantStore').GlobalStore; 
    }

    public getAllDCIs(): DCI[] {
        return this.store.load('dci', []);
    }

    public getDCIById(id: string): DCI | undefined {
        const dcis = this.getAllDCIs();
        return dcis.find(d => d.id === id);
    }

    private normalizeName(name: string): string {
        return name.trim().replace(/\s+/g, ' ');
    }

    public createDCI(data: Omit<DCI, 'id' | 'createdAt' | 'updatedAt'>): DCI {
        const dcis = this.getAllDCIs();
        const normalizedName = this.normalizeName(data.name);

        // Check for duplicate name (case-insensitive)
        if (dcis.some(d => d.name.toLowerCase() === normalizedName.toLowerCase())) {
            throw new Error(`Une DCI avec le nom "${normalizedName}" existe déjà.`);
        }

        const newDCI: DCI = {
            id: `DCI_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            name: normalizedName,
            atcCode: data.atcCode?.trim(),
            synonyms: data.synonyms?.map(s => s.trim()).filter(s => s.length > 0),
            therapeuticClass: data.therapeuticClass?.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        dcis.push(newDCI);
        this.saveDCIs(dcis);
        return newDCI;
    }

    public updateDCI(id: string, updates: Partial<Omit<DCI, 'id' | 'createdAt' | 'updatedAt'>>): DCI {
        const dcis = this.getAllDCIs();
        const idx = dcis.findIndex(d => d.id === id);
        if (idx === -1) throw new Error("DCI non trouvée");

        const currentDCI = dcis[idx];
        let normalizedName = currentDCI.name;

        if (updates.name) {
            normalizedName = this.normalizeName(updates.name);
            // Check for duplicate if name is changing
            if (normalizedName.toLowerCase() !== currentDCI.name.toLowerCase()) {
                 if (dcis.some(d => d.id !== id && d.name.toLowerCase() === normalizedName.toLowerCase())) {
                    throw new Error(`Une DCI avec le nom "${normalizedName}" existe déjà.`);
                }
            }
        }

        const updatedDCI: DCI = {
            ...currentDCI,
            ...updates,
            name: normalizedName, // Ensure normalized name is saved
            atcCode: updates.atcCode !== undefined ? updates.atcCode.trim() : currentDCI.atcCode,
            synonyms: updates.synonyms ? updates.synonyms.map(s => s.trim()).filter(s => s.length > 0) : currentDCI.synonyms,
            therapeuticClass: updates.therapeuticClass !== undefined ? updates.therapeuticClass.trim() : currentDCI.therapeuticClass,
            updatedAt: new Date().toISOString()
        };
        
        // Prevent immutable field changes just in case
        updatedDCI.id = id;
        updatedDCI.createdAt = currentDCI.createdAt;

        dcis[idx] = updatedDCI;
        this.saveDCIs(dcis);
        return updatedDCI;
    }

    public deleteDCI(id: string): void {
        let dcis = this.getAllDCIs();
        // TODO: Check for usage in products before delete? 
        // For now, strict referential integrity might be too heavy for JSON, but good practice.
        // Assuming deletion is allowed for now.
        dcis = dcis.filter(d => d.id !== id);
        this.saveDCIs(dcis);
    }

    private saveDCIs(dcis: DCI[]) {
        this.store.save('dci', dcis);
    }
}

export const globalDCIService = new GlobalDCIService();
