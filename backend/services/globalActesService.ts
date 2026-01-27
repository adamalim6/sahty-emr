
import { globalQuery, globalQueryOne } from '../db/globalPg';

export interface Acte {
    code: string;
    label: string;
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
        };
    }

    public async getAllPaginated(page: number, limit: number, search?: string): Promise<{ data: Acte[], total: number }> {
        const offset = (page - 1) * limit;
        
        let sql = "SELECT * FROM global_actes";
        let countSql = "SELECT COUNT(*) as count FROM global_actes";
        let params: any[] = [];
        let paramIndex = 1;

        if (search) {
            const condition = ` WHERE code_sih LIKE $${paramIndex} OR libelle_sih LIKE $${paramIndex}`;
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
         const rows = await globalQuery("SELECT * FROM global_actes");
         return rows.map(this.mapToModel);
    }
}

export const globalActesService = GlobalActesService.getInstance();
