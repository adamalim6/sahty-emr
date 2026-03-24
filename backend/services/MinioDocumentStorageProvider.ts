import 'dotenv/config';
import { Client } from 'minio';
import { v4 as uuid } from 'uuid';
import { DocumentStorageProvider } from './DocumentStorageProvider';

export class MinioDocumentStorageProvider implements DocumentStorageProvider {
  private client: Client;
  private bucket: string;

  constructor() {
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
      secretKey: process.env.MINIO_SECRET_KEY || 'admin123',
    });

    this.bucket = process.env.MINIO_BUCKET || 'patient-documents';
  }

  async saveBuffer(tenantId: string, buffer: Buffer, metadata: {
    originalName: string;
    mimeType: string;
  }) {
    const id = uuid();
    const ext = metadata.originalName.split('.').pop() || 'tmp';
    const objectName = `${tenantId}/${id}.${ext}`;

    await this.client.putObject(
      this.bucket,
      objectName,
      buffer,
      buffer.length,
      {
        'Content-Type': metadata.mimeType,
      }
    );

    return {
      id,
      storagePath: `${this.bucket}/${objectName}`,
      filename: objectName,
    };
  }

  async getPresignedUrl(storagePath: string) {
    const [bucket, ...rest] = storagePath.split('/');
    const objectName = rest.join('/');

    return this.client.presignedGetObject(
      bucket || this.bucket,
      objectName,
      60 * 5 // 5 minutes
    );
  }

  // Complying with older interface as well if needed
  async save(tenantId: string, filename: string, buffer: Buffer, mimeType: string): Promise<string> {
      const res = await this.saveBuffer(tenantId, buffer, { originalName: filename, mimeType });
      return res.storagePath;
  }

  async delete(storagePath: string): Promise<boolean> {
      const [bucket, ...rest] = storagePath.split('/');
      const objectName = rest.join('/');
      await this.client.removeObject(bucket || this.bucket, objectName);
      return true;
  }

  async exists(storagePath: string): Promise<boolean> {
      try {
          const [bucket, ...rest] = storagePath.split('/');
          const objectName = rest.join('/');
          await this.client.statObject(bucket || this.bucket, objectName);
          return true;
      } catch (e) {
          return false;
      }
  }

  async getStoragePath(storagePath: string): Promise<string> {
      return this.getPresignedUrl(storagePath);
  }

  async getObjectStream(storagePath: string): Promise<NodeJS.ReadableStream> {
      const [bucket, ...rest] = storagePath.split('/');
      const objectName = rest.join('/');

      return this.client.getObject(
          bucket || this.bucket,
          objectName
      );
  }
}
