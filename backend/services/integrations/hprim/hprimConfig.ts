/**
 * HPRIM Configuration
 * 
 * Resolves paths and settings from environment variables.
 * Auto-creates directories on first access.
 */
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_BASE = '/Users/adamalim/sahty_hprim';

export const hprimConfig = {
    get basePath(): string {
        return process.env.HPRIM_BASE_PATH || DEFAULT_BASE;
    },
    get allerPath(): string {
        return process.env.HPRIM_ALLER_PATH || path.join(this.basePath, 'aller');
    },
    get retourPath(): string {
        return process.env.HPRIM_RETOUR_PATH || path.join(this.basePath, 'retour');
    },
    get archivePath(): string {
        return process.env.HPRIM_ARCHIVE_PATH || path.join(this.basePath, 'archive');
    },
    get errorPath(): string {
        return process.env.HPRIM_ERROR_PATH || path.join(this.basePath, 'error');
    },
    get pollIntervalMs(): number {
        return parseInt(process.env.HPRIM_POLL_INTERVAL_MS || '60000', 10);
    },
    get workerEnabled(): boolean {
        const val = process.env.HPRIM_WORKER_ENABLED;
        return val === undefined || val === 'true' || val === '1';
    },
    get maxRetries(): number {
        return parseInt(process.env.HPRIM_MAX_RETRIES || '3', 10);
    },

    /** Ensure all required directories exist */
    ensureDirectories(): void {
        const dirs = [this.basePath, this.allerPath, this.retourPath, this.archivePath, this.errorPath];
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`[HPRIM] Created directory: ${dir}`);
            }
        }
    }
};
