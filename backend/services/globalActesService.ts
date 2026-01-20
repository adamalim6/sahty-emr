
import { getGlobalDB } from '../db/globalDb';
import { Database } from 'sqlite3';

// Promisified Helper (duplicated for now, should be shared)
const all = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows as T[]); });
});

const get = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row as T); });
});

const run = (db: Database, sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(); });
});

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
            active: row.actif === 1
        };
    }

    public async getAllPaginated(page: number, limit: number, search?: string): Promise<{ data: Acte[], total: number }> {
        const db = await getGlobalDB();
        const offset = (page - 1) * limit;
        
        let sql = "SELECT * FROM global_actes";
        let countSql = "SELECT COUNT(*) as count FROM global_actes";
        let params: any[] = [];

        if (search) {
            const condition = " WHERE code_sih LIKE ? OR libelle_sih LIKE ?";
            sql += condition;
            countSql += condition;
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += " LIMIT ? OFFSET ?";
        
        const rows = await all<any>(db, sql, [...params, limit, offset]);
        const countRow = await get<any>(db, countSql, params);
        
        return {
            data: rows.map(this.mapToModel),
            total: countRow?.count || 0
        };
    }
    
    // Helper used by Settings Acte sync potentially
    public async getAll(): Promise<Acte[]> {
         const db = await getGlobalDB();
         const rows = await all<any>(db, "SELECT * FROM global_actes");
         return rows.map(this.mapToModel);
    }
}

export const globalActesService = GlobalActesService.getInstance();
