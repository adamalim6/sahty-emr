const { Pool } = require('pg');
const { Client } = require('minio');
require('dotenv').config();

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const dbName = 'tenant_' + tenantId;
    const pool = new Pool({
        user: process.env.DB_USER || 'sahty',
        password: process.env.DB_PASSWORD || 'sahty',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: dbName
    });

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
        const minioClient = new Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: Number(process.env.MINIO_PORT || 9000),
            useSSL: process.env.MINIO_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || 'sahty_minio_admin',
            secretKey: process.env.MINIO_SECRET_KEY || 'sahty_minio_secret_2024',
        });

        const bucketName = process.env.MINIO_BUCKET || 'patient-documents';
        
        if (doc.storage_path) {
            const [bucket, ...rest] = doc.storage_path.split('/');
            const objectName = rest.join('/');
            console.log(`Checking Bucket: ${bucket || bucketName}, Object: ${objectName}`);
            try {
                const stat = await minioClient.statObject(bucket || bucketName, objectName);
                console.log("File exists: YES", stat);

                console.log("\\n--- 3. BACKEND URL GENERATION ---");
                const url = await minioClient.presignedGetObject(bucket || bucketName, objectName, 60*5);
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
                } catch(e) {
                    console.log("Fetch error:", e.message);
                }

            } catch (e) {
                console.log("File exists: NO", e.message);
            }
        } else {
            console.log("Storage path is NULL for the latest document.");
        }
    } catch (e) {
        console.log("DB Error:", e);
    } finally {
        pool.end();
    }
}
run();
