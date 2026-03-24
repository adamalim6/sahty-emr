import 'dotenv/config';
import { Client } from 'minio';

const client = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: process.env.MINIO_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'admin123',
});

const bucket = process.env.MINIO_BUCKET || 'patient-documents';

async function verifyBucket() {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
        console.log(`Bucket ${bucket} does not exist. Creating...`);
        await client.makeBucket(bucket, 'us-east-1');
        console.log(`Bucket ${bucket} created successfully.`);
    } else {
        console.log(`Bucket ${bucket} already exists.`);
    }
}

verifyBucket().catch(console.error);
