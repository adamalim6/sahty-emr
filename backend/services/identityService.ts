
import { identityQuery, identityTransaction, getIdentityPool } from '../db/identityPg';
import { tenantQuery, tenantTransaction, getTenantPool } from '../db/tenantPg';
import { Pool } from 'pg';

export interface IdentityPatient {
    id: string;
    firstName: string;
    lastName: string;
    dob?: string;
    sex?: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateIdentityPayload {
    firstName: string;
    lastName: string;
    dob?: string;
    sex?: string;
}

export class IdentityService {
    
    // --- Context Helpers ---

    private getPool(tenantId: string): Pool {
        return tenantId === 'GLOBAL' ? getIdentityPool() : getTenantPool(tenantId);
    }

    private async queryOne(tenantId: string, sql: string, params: any[] = []): Promise<any> {
        return tenantId === 'GLOBAL' 
            ? (await identityQuery(sql, params))[0] 
            : (await tenantQuery(tenantId, sql, params))[0];
    }

    private async query(tenantId: string, sql: string, params: any[] = []): Promise<any[]> {
        return tenantId === 'GLOBAL' 
            ? await identityQuery(sql, params)
            : await tenantQuery(tenantId, sql, params);
    }

    // --- READ ---

    async getPatientById(tenantId: string, id: string): Promise<IdentityPatient | null> {
        const row = await this.queryOne(tenantId, 
            `SELECT * FROM identity.master_patients WHERE id = $1`, 
            [id]
        );
        return row ? this.mapPatient(row) : null;
    }

    async searchPatients(tenantId: string, query: string): Promise<IdentityPatient[]> {
        const sql = `
            SELECT * FROM identity.master_patients 
            WHERE (first_name ILIKE $1 OR last_name ILIKE $1)
            AND status = 'ACTIVE'
            LIMIT 50
        `;
        const rows = await this.query(tenantId, sql, [`%${query}%`]);
        return rows.map(this.mapPatient);
    }

    async getPatientDocuments(tenantId: string, masterPatientId: string): Promise<any[]> {
        return await this.query(tenantId, `SELECT * FROM identity.master_patient_documents WHERE master_patient_id = $1`, [masterPatientId]);
    }

    // --- WRITE ---

    async createPatient(tenantId: string, payload: CreateIdentityPayload): Promise<IdentityPatient> {
        const sql = `
            INSERT INTO identity.master_patients 
            (first_name, last_name, dob, sex)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const params = [
            payload.firstName, 
            payload.lastName, 
            payload.dob || null, 
            payload.sex || null
        ];

        const row = await this.queryOne(tenantId, sql, params);
        return this.mapPatient(row);
    }

    // --- HELPERS ---

    private mapPatient(row: any): IdentityPatient {
        return {
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            dob: row.dob instanceof Date ? row.dob.toISOString().split('T')[0] : row.dob,
            sex: row.sex,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

export const identityService = new IdentityService();
