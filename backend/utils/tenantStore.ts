import * as fs from 'fs';
import * as path from 'path';

const DATA_ROOT = path.resolve(__dirname, '../data');
const TENANTS_DIR = path.join(DATA_ROOT, 'tenants');
const GLOBAL_DIR = path.join(DATA_ROOT, 'global');

// Ensure base directories exist
if (!fs.existsSync(TENANTS_DIR)) fs.mkdirSync(TENANTS_DIR, { recursive: true });
if (!fs.existsSync(GLOBAL_DIR)) fs.mkdirSync(GLOBAL_DIR, { recursive: true });

export type TenantModule = 'pharmacy' | 'emr_admissions' | 'settings' | 'pharmacy_catalog';
export type GlobalModule = 'patients' | 'admins' | 'roles' | 'products' | 'suppliers';

/**
 * atomicWriteJson
 * Writes data to a temporary file then renames it to target.
 * Prevents corruption on crash.
 */
function atomicWriteJson<T>(filePath: string, data: T): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    try {
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch {}
        }
        throw new Error(`Atomic write failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * readJsonSafe
 * Reads JSON file. Returns defaultValue if missing.
 * Throws on parse error (corruption).
 */
function readJsonSafe<T>(filePath: string, defaultValue: T): T {
    if (!fs.existsSync(filePath)) {
        return defaultValue;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as T;
    } catch (error) {
        console.error(`[CRITICAL] Failed to parse JSON at ${filePath}. Possible corruption.`);
        throw new Error(`Database corruption detected at ${filePath}`);
    }
}

export class TenantStore {
    private tenantId: string;

    constructor(tenantId: string) {
        if (!tenantId || typeof tenantId !== 'string') {
            throw new Error("TenantStore initialized with invalid tenantId");
        }
        // Basic sanitization to prevent directory traversal
        if (tenantId.includes('..') || tenantId.includes('/') || tenantId.includes('\\')) {
             throw new Error("Invalid tenantId format");
        }
        this.tenantId = tenantId;
    }

    private getTenantPath(moduleName: TenantModule): string {
        return path.join(TENANTS_DIR, this.tenantId, `${moduleName}.json`);
    }

    /**
     * load
     * Loads data for a specific module for this tenant.
     * Always reads from disk (no caching in this layer to ensure safety).
     */
    public load<T>(moduleName: TenantModule, defaultValue: T): T {
        const filePath = this.getTenantPath(moduleName);
        return readJsonSafe<T>(filePath, defaultValue);
    }

    /**
     * save
     * Atomically saves data for a specific module.
     */
    public save<T>(moduleName: TenantModule, data: T): void {
        const filePath = this.getTenantPath(moduleName);
        atomicWriteJson(filePath, data);
    }

    /**
     * ensureTenantFolder
     * Creates the tenant directory if it doesn't exist.
     */
    public ensureTenantFolder(): void {
        const dir = path.join(TENANTS_DIR, this.tenantId);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * listTenants
     * Returns a list of all tenant IDs (directory names).
     */
    public static listTenants(): string[] {
        if (!fs.existsSync(TENANTS_DIR)) return [];
        return fs.readdirSync(TENANTS_DIR).filter(file => {
            return fs.statSync(path.join(TENANTS_DIR, file)).isDirectory();
        });
    }
}

export class GlobalStore {
    private static getGlobalPath(moduleName: GlobalModule): string {
        return path.join(GLOBAL_DIR, `${moduleName}.json`);
    }

    public static load<T>(moduleName: GlobalModule, defaultValue: T): T {
        return readJsonSafe<T>(GlobalStore.getGlobalPath(moduleName), defaultValue);
    }

    public static save<T>(moduleName: GlobalModule, data: T): void {
        atomicWriteJson(GlobalStore.getGlobalPath(moduleName), data);
    }
}
