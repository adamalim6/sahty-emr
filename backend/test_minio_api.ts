import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getTenantPool } from './db/tenantPg';
import { MinioDocumentStorageProvider } from './services/MinioDocumentStorageProvider';
import { PatientDocumentService } from './services/patientDocumentService';
import { PatientDocumentRepository } from './repositories/patientDocumentRepository';
import { globalAdminService } from './services/globalAdminService';

async function testMinio() {
    try {
        console.log('Testing Minio Provider directly...');
        // Need a tenant pool
        const tenants = await globalAdminService.getAllTenants();
        if (tenants.length === 0) throw new Error('No tenants found');
        
        const tenant = tenants[0];
        const pool = getTenantPool(tenant.id);
        const client = await pool.connect();

        try {
            const patientId = uuidv4();
            const storageProvider = new MinioDocumentStorageProvider();
            const repository = new PatientDocumentRepository();
            const service = new PatientDocumentService(repository, storageProvider);

            const buffer = Buffer.from('Testing MinIO upload buffer content');
            console.log('Got buffer to upload...');

            const docId = await service.createDocumentFromBuffer(client, {
                tenantId: tenant.id,
                buffer,
                originalName: 'test-document.txt',
                mimeType: 'text/plain',
                patientId,
                documentType: 'LAB_REPORT'
            });

            console.log('✅ Document uploaded successfully. ID:', docId);

            const url = await service.getDocumentUrl(client, docId, tenant.id);
            console.log('✅ Generated presigned URL:', url);

        } catch (innerErr) {
            console.error('Inner error:', innerErr);
            throw innerErr;
        } finally {
            client.release();
            await pool.end();
        }
    } catch (e: any) {
        console.error('❌ Test failed:', e);
        process.exit(1);
    }
}

testMinio();
