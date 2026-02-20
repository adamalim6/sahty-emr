
import { identityQuery, identityTransaction, getIdentityPool } from '../db/identityPg';
import { tenantQuery, tenantTransaction, getTenantPool } from '../db/tenantPg';
import { Pool } from 'pg';

export interface IdentityPatient {
    id: string; // mpi_source_record_id (or mpi_person_id if we have it)
    firstName: string;
    lastName: string;
    dob?: string;
    sex?: string;
    status: string;
    // We can include tenantId to show where it came from
    tenantId: string;
    tenantPatientId: string;
}

export class IdentityService {
    
    // --- Context Helpers ---

    private getPool(tenantId: string): Pool {
        return tenantId === 'GLOBAL' ? getIdentityPool() : getTenantPool(tenantId);
    }

    private async query(tenantId: string, sql: string, params: any[] = []): Promise<any[]> {
        return tenantId === 'GLOBAL' 
            ? await identityQuery(sql, params)
            : await tenantQuery(tenantId, sql, params);
    }

    // --- READ ---

    async getPatientBySourceId(tenantId: string, sourceRecordId: string): Promise<IdentityPatient | null> {
        // Query mpi_source_records
        const rows = await this.query(tenantId, `
            SELECT * FROM identity.mpi_source_records WHERE source_record_id = $1
        `, [sourceRecordId]);
        
        return rows.length > 0 ? this.mapSourceRecord(rows[0]) : null;
    }

    async searchPatients(tenantId: string, query: string): Promise<IdentityPatient[]> {
        // Search against mpi_source_records
        // This finds specific tenant records. 
        // In a real EMPI, we might search proper clusters (Golden Records), 
        // but since we only store source records for now, we search them.
        const sql = `
            SELECT * FROM identity.mpi_source_records 
            WHERE (current_first_name ILIKE $1 OR current_last_name ILIKE $1)
            AND status = 'ACTIVE'
            LIMIT 50
        `;
        const rows = await this.query(tenantId, sql, [`%${query}%`]);
        return rows.map(this.mapSourceRecord);
    }

    async getPatientIdentifiers(tenantId: string, sourceRecordId: string): Promise<any[]> {
        return await this.query(tenantId, `
            SELECT * FROM identity.mpi_source_identifiers 
            WHERE source_record_id = $1
        `, [sourceRecordId]);
    }

    // --- HELPERS ---

    private mapSourceRecord(row: any): IdentityPatient {
        return {
            id: row.source_record_id,
            firstName: row.current_first_name,
            lastName: row.current_last_name,
            dob: row.current_dob instanceof Date ? row.current_dob.toISOString().split('T')[0] : row.current_dob,
            sex: row.current_sex,
            status: row.status,
            tenantId: row.tenant_id,
            tenantPatientId: row.tenant_patient_id
        };
    }
}

export const identityService = new IdentityService();
