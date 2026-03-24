import { getTenantPool } from '../db/tenantPg';
import { PatientDocumentService } from '../services/patientDocumentService';
import { MinioDocumentStorageProvider } from '../services/MinioDocumentStorageProvider';
import { PatientDocumentRepository } from '../repositories/patientDocumentRepository';

async function run() {
    console.log("--- 1. PROVE WHAT /stream IS RETURNING ---");
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    
    try {
        const client = await pool.connect();
        try {
            // Get latest document id
            const res = await client.query('SELECT id, storage_path, mime_type, original_filename FROM patient_documents ORDER BY created_at DESC LIMIT 1;');
            if (res.rowCount === 0) { console.log("No docs found in DB."); return; }
            const doc = res.rows[0];
            
            console.log("Selected Document ID:", doc.id);
            console.log("Storage Path:", doc.storage_path);
            console.log("Original Filename:", doc.original_filename);
            
            try {
                const storageProvider = new MinioDocumentStorageProvider();
                const repository = new PatientDocumentRepository();
                const dynService = new PatientDocumentService(repository, storageProvider);
                
                const { stream, mimeType } = await dynService.getDocumentStream(client, doc.id, tenantId);
                console.log("Content-Type set by backend:", mimeType);
                
                let firstChunk = true;
                let totalBytes = 0;
                
                stream.on('data', (chunk: Buffer) => {
                    totalBytes += chunk.length;
                    if (firstChunk) {
                        firstChunk = false;
                        console.log("First 20 bytes (string):", chunk.slice(0, 20).toString());
                        console.log("First 20 bytes (HEX):", chunk.slice(0, 20).toString('hex'));
                        if (chunk.slice(0, 5).toString() === '%PDF-') {
                            console.log("VERDICT: Starts with %PDF- (VALID)");
                        } else {
                            console.log("VERDICT: DOES NOT start with %PDF- (INVALID)");
                        }
                    }
                });

                stream.on('error', (err: any) => {
                    console.error("Stream error emitted:", err);
                });

                await new Promise((resolve) => {
                    stream.on('end', () => {
                        console.log("Content-Length (total bytes streamed):", totalBytes);
                        resolve(true);
                    });
                    setTimeout(() => resolve(true), 3000); // 3 sec timeout
                });
            } catch (err: any) {
                console.error("getDocumentStream threw error:", err.message);
            }
            
        } finally {
            client.release();
        }
    } finally {
        // @ts-ignore
        pool.end();
    }
}
run();
