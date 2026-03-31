import { CatalogTableName, labCatalogRepository } from '../../repositories/superadmin/labCatalogRepository';

const ALLOWED_TABLES: CatalogTableName[] = [
    'lab_analytes',
    'lab_methods',
    'lab_specimen_types',
    'lab_container_types',
    'lab_sections',
    'lab_sub_sections'
];

export const labCatalogService = {
    async getAll(resource: string) {
        this.validateResource(resource);
        return labCatalogRepository.findAll(this.mapResourceToTable(resource));
    },

    async create(resource: string, payload: any) {
        this.validateResource(resource);
        const table = this.mapResourceToTable(resource);
        
        if (!payload.code) throw new Error("Code is required");
        // All LIMS tables standardize exclusively on 'libelle'
        const labelField = 'libelle';
        if (!payload[labelField]) throw new Error(`Label (${labelField}) is required`);

        // Check Unique constraint
        const existing = await labCatalogRepository.findByCode(table, payload.code);
        if (existing) {
            throw new Error(`Un élément avec le code '${payload.code}' existe déjà.`);
        }


        return labCatalogRepository.create(table, payload);
    },

    async update(resource: string, id: string, payload: any) {
        this.validateResource(resource);
        const table = this.mapResourceToTable(resource);

        if (payload.code) {
            const existing = await labCatalogRepository.findByCode(table, payload.code, id);
            if (existing) {
                throw new Error(`Un élément avec le code '${payload.code}' existe déjà.`);
            }
        }

        // Remove un-updatable fields
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;

        return labCatalogRepository.update(table, id, payload);
    },

    async deactivate(resource: string, id: string) {
        this.validateResource(resource);
        return labCatalogRepository.setActivationStatus(this.mapResourceToTable(resource), id, false);
    },

    async reactivate(resource: string, id: string) {
        this.validateResource(resource);
        return labCatalogRepository.setActivationStatus(this.mapResourceToTable(resource), id, true);
    },

    validateResource(resource: string) {
        const mapped = this.mapResourceToTable(resource);
        if (!ALLOWED_TABLES.includes(mapped)) {
            throw new Error(`Invalid catalog resource: ${resource}`);
        }
    },

    mapResourceToTable(resource: string): CatalogTableName {
        // e.g., 'lab-analytes' -> 'lab_analytes'
        return resource.replace(/-/g, '_') as CatalogTableName;
    }
};
