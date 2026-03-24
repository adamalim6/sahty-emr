import { Pool } from 'pg';
import { LabReferenceRepository } from '../repositories/labReferenceRepository';
import { LabAnalyteContext } from '../models/labReference';

export class LabReferenceService {
    private repository: LabReferenceRepository;

    constructor(repository: LabReferenceRepository) {
        this.repository = repository;
    }

    async getAnalyteContextsByGlobalActs(pool: Pool, globalActIds: string[]): Promise<LabAnalyteContext[]> {
        const client = await pool.connect();
        try {
            return await this.repository.getAnalyteContextsByGlobalActs(client, globalActIds);
        } finally {
            client.release();
        }
    }

    async searchAnalyteContexts(pool: Pool, query: string): Promise<LabAnalyteContext[]> {
        const client = await pool.connect();
        try {
            return await this.repository.searchAnalyteContexts(client, query);
        } finally {
            client.release();
        }
    }

    async getAnalyteContextDetails(pool: Pool, ids: string[]): Promise<LabAnalyteContext[]> {
        const client = await pool.connect();
        try {
            return await this.repository.getAnalyteContextDetails(client, ids);
        } finally {
            client.release();
        }
    }

    async searchLabAnalytesOrActs(pool: Pool, query: string): Promise<any[]> {
        const client = await pool.connect();
        try {
            return await this.repository.searchLabAnalytesOrActs(client, query);
        } finally {
            client.release();
        }
    }
}
