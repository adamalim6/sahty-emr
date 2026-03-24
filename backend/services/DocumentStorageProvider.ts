export interface DocumentStorageProvider {
    save(tenantId: string, filename: string, buffer: Buffer, mimeType: string): Promise<string>;
    
    saveBuffer(tenantId: string, buffer: Buffer, metadata: { originalName: string; mimeType: string; }): Promise<{
        id: string;
        storagePath: string;
        filename: string;
    }>;

    delete(storagePath: string): Promise<boolean>;
    exists(storagePath: string): Promise<boolean>;
    getStoragePath(storagePath: string): Promise<string>;
    getPresignedUrl(storagePath: string): Promise<string>;
    getObjectStream(storagePath: string): Promise<NodeJS.ReadableStream>;
}

export class LocalDocumentStorageProvider implements DocumentStorageProvider {
    // Stub implementation for now until MinIO is implemented
    
    async save(tenantId: string, filename: string, buffer: Buffer, mimeType: string): Promise<string> {
        console.log(`[STUB] Saving object ${filename} with mime ${mimeType}`);
        return `${tenantId}/${filename}`;
    }

    async saveBuffer(tenantId: string, buffer: Buffer, metadata: { originalName: string; mimeType: string; }): Promise<{ id: string; storagePath: string; filename: string; }> {
        const id = 'local-stub-id';
        const filename = metadata.originalName;
        console.log(`[STUB] Saving buffer for ${filename} with mime ${metadata.mimeType}`);
        return {
            id,
            storagePath: `${tenantId}/${filename}`,
            filename
        };
    }

    async delete(storagePath: string): Promise<boolean> {
        console.log(`[STUB] Deleting object at ${storagePath}`);
        return true;
    }

    async exists(storagePath: string): Promise<boolean> {
        console.log(`[STUB] Checking existence of object at ${storagePath}`);
        return true;
    }

    async getStoragePath(storagePath: string): Promise<string> {
        return storagePath;
    }

    async getPresignedUrl(storagePath: string): Promise<string> {
        return `http://localhost/stubbed-presigned-url/${storagePath}`;
    }

    async getObjectStream(storagePath: string): Promise<NodeJS.ReadableStream> {
        const { Readable } = require('stream');
        return Readable.from([Buffer.from("stub file bytes")]);
    }
}
