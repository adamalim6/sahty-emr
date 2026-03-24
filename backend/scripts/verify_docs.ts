import { getTenantPool } from '../db/tenantPg';
import { MinioDocumentStorageProvider } from '../services/MinioDocumentStorageProvider';

async function run() {
    console.log("Starting trace debug for document API...");
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);

    console.log("--- 1. DATABASE VERIFICATION ---");
    try {
        const res = await pool.query('SELECT id, original_filename, storage_path, mime_type, document_type FROM public.patient_documents ORDER BY created_at DESC LIMIT 5;');
        console.table(res.rows);

        let docTypeStats = await pool.query('SELECT document_type, COUNT(*) FROM public.patient_documents GROUP BY document_type;');
        console.log("Document Types:", docTypeStats.rows);

        if (res.rows.length === 0) {
            console.log("No documents found in DB.");
            process.exit(0);
        }

        const doc = res.rows[0];

        console.log("\\n--- 2. MINIO VERIFICATION ---");
        const storageProvider = new MinioDocumentStorageProvider();
        
        if (doc.storage_path) {
            console.log(`Checking storage path: ${doc.storage_path}`);
            try {
                // @ts-ignore
                const client = storageProvider.client;
                // @ts-ignore
                const bucketName = storageProvider.bucket;

                const [bucket, ...rest] = doc.storage_path.split('/');
                const objectName = rest.join('/');
                const stat = await client.statObject(bucket || bucketName, objectName);
                console.log("File exists: YES", stat);

                console.log("\\n--- 3. BACKEND URL GENERATION ---");
                const url = await storageProvider.getPresignedUrl(doc.storage_path);
                console.log("Generated URL:", url);

                // Fetch URL via HTTP
                console.log("\\nTesting URL manually...");
                try {
                    const r = await fetch(url);
                    console.log("URL Response Status:", r.status);
                    if (!r.ok) {
                        const txt = await r.text();
                        console.log("Error body:", txt.substring(0, 200));
                    }
                } catch(e: any) {
                    console.log("Fetch error:", e.message);
                }

            } catch (e: any) {
                console.log("File exists: NO", e.message);
            }
        } else {
            console.log("Storage path is NULL for the latest document.");
        }
    } catch (e) {
        console.log("DB Error:", e);
    } finally {
        // @ts-ignore
        pool.end();
    }
}
run();
