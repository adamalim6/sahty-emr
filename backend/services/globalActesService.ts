
import { globalQuery, globalQueryOne } from '../db/globalPg';

export interface Acte {
    id?: string;
    code: string;
    label: string;
    family_id?: string;
    sub_family_id?: string;
    family: string;
    subFamily: string;
    ngapCode?: string;
    ngapLabel?: string;
    ngapCoeff?: string;
    ccamCode?: string;
    ccamLabel?: string;
    type?: string;
    duration?: number;
    active: boolean;
    catalog_version?: number;
    // Biology attributes
    bio_grise?: boolean;
    bio_grise_prescription?: boolean;
    bio_delai_resultats_heures?: number;
    bio_cle_facturation?: string;
    bio_nombre_b?: number;
    bio_nombre_b1?: number;
    bio_nombre_b2?: number;
    bio_nombre_b3?: number;
    bio_nombre_b4?: number;
    bio_instructions_prelevement?: string;
    bio_commentaire?: string;
    bio_commentaire_prescription?: string;
    default_specimen_type?: string;
    is_lims_enabled?: boolean;
    lims_template_code?: string;
}

export interface Famille {
    id: string;
    code: string;
    libelle: string;
    actif: boolean;
    created_at?: string;
}

export interface SousFamille {
    id: string;
    famille_id: string;
    code: string;
    libelle: string;
    actif: boolean;
    created_at?: string;
}

export class GlobalActesService {
    private static instance: GlobalActesService;

    public static getInstance(): GlobalActesService {
        if (!GlobalActesService.instance) {
            GlobalActesService.instance = new GlobalActesService();
        }
        return GlobalActesService.instance;
    }

    private mapToModel(row: any): Acte {
        return {
            id: row.id,
            code: row.code_sih,
            label: row.libelle_sih,
            family_id: row.famille_id,
            sub_family_id: row.sous_famille_id,
            family: row.famille_sih || '',
            subFamily: row.sous_famille_sih || '',
            ngapCode: row.code_ngap,
            ngapLabel: row.libelle_ngap,
            ngapCoeff: row.cotation_ngap,
            ccamCode: row.code_ccam,
            ccamLabel: row.libelle_ccam,
            type: row.type_acte,
            duration: row.duree_moyenne,
            active: row.actif === true || row.actif === 1,
            catalog_version: row.catalog_version,
            bio_grise: row.bio_grise,
            bio_grise_prescription: row.bio_grise_prescription,
            bio_delai_resultats_heures: row.bio_delai_resultats_heures,
            bio_cle_facturation: row.bio_cle_facturation,
            bio_nombre_b: row.bio_nombre_b,
            bio_nombre_b1: row.bio_nombre_b1,
            bio_nombre_b2: row.bio_nombre_b2,
            bio_nombre_b3: row.bio_nombre_b3,
            bio_nombre_b4: row.bio_nombre_b4,
            bio_instructions_prelevement: row.bio_instructions_prelevement,
            bio_commentaire: row.bio_commentaire,
            bio_commentaire_prescription: row.bio_commentaire_prescription,
            default_specimen_type: row.default_specimen_type,
            is_lims_enabled: row.is_lims_enabled,
            lims_template_code: row.lims_template_code
        };
    }

    public async getAllPaginated(page: number, limit: number, search?: string): Promise<{ data: Acte[], total: number }> {
        const offset = (page - 1) * limit;
        
        let sql = `
            SELECT a.*, f.libelle as famille_sih, sf.libelle as sous_famille_sih 
            FROM public.global_actes a
            LEFT JOIN public.sih_familles f ON a.famille_id = f.id
            LEFT JOIN public.sih_sous_familles sf ON a.sous_famille_id = sf.id
        `;
        let countSql = "SELECT COUNT(*) as count FROM public.global_actes a";
        let params: any[] = [];
        let paramIndex = 1;

        if (search) {
            const condition = ` WHERE a.code_sih ILIKE $${paramIndex} OR a.libelle_sih ILIKE $${paramIndex}`;
            sql += condition;
            countSql += condition;
            params.push(`%${search}%`);
            paramIndex++;
        }

        sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        
        const countRow = await globalQueryOne<any>(countSql, params.slice(0, params.length > 0 && search ? 1 : 0));
        const rows = await globalQuery(sql, [...params, limit, offset]);
        
        return {
            data: rows.map(this.mapToModel),
            total: parseInt(countRow?.count || '0')
        };
    }
    
    public async getAll(): Promise<Acte[]> {
         const rows = await globalQuery(`
            SELECT a.*, f.libelle as famille_sih, sf.libelle as sous_famille_sih 
            FROM public.global_actes a
            LEFT JOIN public.sih_familles f ON a.famille_id = f.id
            LEFT JOIN public.sih_sous_familles sf ON a.sous_famille_id = sf.id
         `);
         return rows.map(this.mapToModel);
    }
    
    public async createActe(acte: Partial<Acte>): Promise<Acte> {
        // Build dynamic insert query based on provided attributes
        const keys: string[] = [];
        const values: any[] = [];
        const placeholders: string[] = [];
        
        let i = 1;
        const addParam = (dbKey: string, val: any) => {
            if (val !== undefined) {
                keys.push(dbKey);
                values.push(val);
                placeholders.push(`$${i++}`);
            }
        };

        if (!acte.code || !acte.label) {
            throw new Error('Code SIH and Label SIH are required');
        }

        addParam('code_sih', acte.code);
        addParam('libelle_sih', acte.label);
        addParam('famille_id', acte.family_id || null);
        addParam('sous_famille_id', acte.sub_family_id || null);
        addParam('code_ngap', acte.ngapCode || null);
        addParam('libelle_ngap', acte.ngapLabel || null);
        addParam('cotation_ngap', acte.ngapCoeff || null);
        addParam('code_ccam', acte.ccamCode || null);
        addParam('libelle_ccam', acte.ccamLabel || null);
        addParam('type_acte', acte.type || null);
        addParam('duree_moyenne', acte.duration || null);
        addParam('actif', acte.active !== false);
        addParam('bio_grise', acte.bio_grise || null);
        addParam('bio_grise_prescription', acte.bio_grise_prescription || null);
        addParam('bio_delai_resultats_heures', acte.bio_delai_resultats_heures || null);
        addParam('bio_cle_facturation', acte.bio_cle_facturation || null);
        addParam('bio_nombre_b', acte.bio_nombre_b || null);
        addParam('bio_nombre_b1', acte.bio_nombre_b1 || null);
        addParam('bio_nombre_b2', acte.bio_nombre_b2 || null);
        addParam('bio_nombre_b3', acte.bio_nombre_b3 || null);
        addParam('bio_nombre_b4', acte.bio_nombre_b4 || null);
        addParam('bio_instructions_prelevement', acte.bio_instructions_prelevement || null);
        addParam('bio_commentaire', acte.bio_commentaire || null);
        addParam('bio_commentaire_prescription', acte.bio_commentaire_prescription || null);
        addParam('default_specimen_type', acte.default_specimen_type || null);
        addParam('is_lims_enabled', acte.is_lims_enabled || false);
        addParam('lims_template_code', acte.lims_template_code || null);
        addParam('catalog_version', 1);

        const sql = `
            INSERT INTO public.global_actes (${keys.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;

        const result = await globalQueryOne(sql, values);
        if (!result) throw new Error("Failed to insert acte");

        // Refetch to get relational joins
        const refetch = await globalQueryOne(`
            SELECT a.*, f.libelle as famille_sih, sf.libelle as sous_famille_sih 
            FROM public.global_actes a
            LEFT JOIN public.sih_familles f ON a.famille_id = f.id
            LEFT JOIN public.sih_sous_familles sf ON a.sous_famille_id = sf.id
            WHERE a.id = $1
        `, [result.id]);

        return this.mapToModel(refetch);
    }

    public async updateActe(code_sih: string, acte: Partial<Acte>): Promise<Acte> {
        const updates: string[] = [];
        const values: any[] = [];
        let i = 1;

        const addParam = (dbKey: string, val: any) => {
            if (val !== undefined) {
                updates.push(`${dbKey} = $${i++}`);
                values.push(val);
            }
        };

        addParam('libelle_sih', acte.label);
        addParam('famille_id', acte.family_id || null);
        addParam('sous_famille_id', acte.sub_family_id || null);
        addParam('code_ngap', acte.ngapCode || null);
        addParam('libelle_ngap', acte.ngapLabel || null);
        addParam('cotation_ngap', acte.ngapCoeff || null);
        addParam('code_ccam', acte.ccamCode || null);
        addParam('libelle_ccam', acte.ccamLabel || null);
        addParam('type_acte', acte.type || null);
        addParam('duree_moyenne', acte.duration || null);
        addParam('actif', acte.active !== false);
        addParam('bio_grise', acte.bio_grise);
        addParam('bio_grise_prescription', acte.bio_grise_prescription);
        addParam('bio_delai_resultats_heures', acte.bio_delai_resultats_heures);
        addParam('bio_cle_facturation', acte.bio_cle_facturation);
        addParam('bio_nombre_b', acte.bio_nombre_b);
        addParam('bio_nombre_b1', acte.bio_nombre_b1);
        addParam('bio_nombre_b2', acte.bio_nombre_b2);
        addParam('bio_nombre_b3', acte.bio_nombre_b3);
        addParam('bio_nombre_b4', acte.bio_nombre_b4);
        addParam('bio_instructions_prelevement', acte.bio_instructions_prelevement);
        addParam('bio_commentaire', acte.bio_commentaire);
        addParam('bio_commentaire_prescription', acte.bio_commentaire_prescription);
        addParam('default_specimen_type', acte.default_specimen_type);
        addParam('is_lims_enabled', acte.is_lims_enabled);
        addParam('lims_template_code', acte.lims_template_code);
        addParam('catalog_version', (acte.catalog_version || 1) + 1);

        if (updates.length > 0) {
            values.push(code_sih); // The id pointer for the WHERE clause
            const sql = `
                UPDATE public.global_actes 
                SET ${updates.join(', ')} 
                WHERE code_sih = $${i}
                RETURNING *
            `;
            const result = await globalQueryOne(sql, values);
            if (!result) throw new Error("Acte not found or failed to update");

            const refetch = await globalQueryOne(`
                SELECT a.*, f.libelle as famille_sih, sf.libelle as sous_famille_sih 
                FROM public.global_actes a
                LEFT JOIN public.sih_familles f ON a.famille_id = f.id
                LEFT JOIN public.sih_sous_familles sf ON a.sous_famille_id = sf.id
                WHERE a.id = $1
            `, [result.id]);

            return this.mapToModel(refetch);
        } else {
            throw new Error("No fields to update");
        }
    }

    public async deleteActe(id: string): Promise<void> {
        await globalQuery('DELETE FROM public.global_actes WHERE id = $1', [id]);
    }

    // --- Familles ---
    public async getFamilles(): Promise<Famille[]> {
        return globalQuery('SELECT * FROM public.sih_familles ORDER BY libelle ASC');
    }

    public async createFamille(data: Partial<Famille>): Promise<Famille | null> {
        if (!data.code || !data.libelle) throw new Error('Code and Libelle are required');
        
        return globalQueryOne(`
            INSERT INTO public.sih_familles (code, libelle, actif)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [data.code, data.libelle, data.actif !== false]);
    }

    public async updateFamille(id: string, data: Partial<Famille>): Promise<Famille | null> {
        if (!data.code || !data.libelle) throw new Error('Code and Libelle are required');

        return globalQueryOne(`
            UPDATE public.sih_familles 
            SET code = $1, libelle = $2, actif = $3
            WHERE id = $4
            RETURNING *
        `, [data.code, data.libelle, data.actif !== false, id]);
    }

    public async deleteFamille(id: string): Promise<void> {
        await globalQuery('DELETE FROM public.sih_familles WHERE id = $1', [id]);
    }

    // --- Sous-Familles ---
    public async getSousFamilles(): Promise<SousFamille[]> {
        return globalQuery('SELECT * FROM public.sih_sous_familles ORDER BY libelle ASC');
    }

    public async createSousFamille(data: Partial<SousFamille>): Promise<SousFamille | null> {
        if (!data.famille_id || !data.code || !data.libelle) throw new Error('Famille_id, Code and Libelle are required');
        
        return globalQueryOne(`
            INSERT INTO public.sih_sous_familles (famille_id, code, libelle, actif)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [data.famille_id, data.code, data.libelle, data.actif !== false]);
    }

    public async updateSousFamille(id: string, data: Partial<SousFamille>): Promise<SousFamille | null> {
        if (!data.famille_id || !data.code || !data.libelle) throw new Error('Famille_id, Code and Libelle are required');

        return globalQueryOne(`
            UPDATE public.sih_sous_familles 
            SET famille_id = $1, code = $2, libelle = $3, actif = $4
            WHERE id = $5
            RETURNING *
        `, [data.famille_id, data.code, data.libelle, data.actif !== false, id]);
    }

    public async deleteSousFamille(id: string): Promise<void> {
        await globalQuery('DELETE FROM public.sih_sous_familles WHERE id = $1', [id]);
    }
}

export const globalActesService = GlobalActesService.getInstance();
