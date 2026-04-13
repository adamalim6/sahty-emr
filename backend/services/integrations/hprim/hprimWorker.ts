/**
 * HPRIM Worker
 * 
 * Periodic poller that watches the retour/ folder for inbound ORU files.
 * Auto-starts on server boot when HPRIM_WORKER_ENABLED is true.
 * 
 * Lifecycle:
 * - start() — begins polling
 * - stop() — gracefully stops
 * 
 * Idempotent: skips files already tracked in lab_hprim_messages.
 */

import { globalQuery } from '../../../db/globalPg';
import { hprimConfig } from './hprimConfig';
import { listReadyFiles, readHprFile } from './hprimFileService';
import { hprimInboundService } from './hprimInboundService';

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

/** Timeout wrapper: rejects if fn takes longer than ms */
function withTimeout<T>(fn: () => Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`[HPRIM Worker] Timeout after ${ms}ms: ${label}`));
        }, ms);

        fn()
            .then(result => { clearTimeout(timer); resolve(result); })
            .catch(err => { clearTimeout(timer); reject(err); });
    });
}

const POLL_TIMEOUT_MS = 30_000; // 30s max per poll cycle

/**
 * Single poll cycle: scan retour/ and process any ready files
 */
async function pollOnce(): Promise<void> {
    if (isProcessing) {
        console.log('[HPRIM Worker] Previous cycle still running — skipping');
        return;
    }
    isProcessing = true;

    try {
        const readyFiles = listReadyFiles(hprimConfig.retourPath);

        if (readyFiles.length === 0) return;

        console.log(`[HPRIM Worker] Found ${readyFiles.length} ready file(s) in retour/`);

        // Get all tenants for processing
        const tenants = await withTimeout(
            () => globalQuery<{ id: string }>('SELECT id FROM tenants'),
            5000,
            'tenant lookup'
        );

        for (const file of readyFiles) {
            const rawContent = readHprFile(file.hprPath);

            // Process for the first tenant (in production, route by patient IPP → tenant)
            if (tenants.length > 0) {
                const tenantId = tenants[0].id;
                await withTimeout(
                    () => hprimInboundService.processOruFile(
                        tenantId,
                        file.hprFile,
                        rawContent,
                        file.hprPath,
                        file.okPath
                    ),
                    POLL_TIMEOUT_MS,
                    `processing ${file.hprFile}`
                );
            }
        }

    } catch (err: any) {
        console.error('[HPRIM Worker] Poll error:', err.message);
    } finally {
        isProcessing = false;
    }
}

/**
 * Start the HPRIM inbound worker
 */
export function startHprimWorker(): void {
    if (!hprimConfig.workerEnabled) {
        console.log('[HPRIM Worker] Disabled (HPRIM_WORKER_ENABLED != true)');
        return;
    }

    // Ensure directories exist
    hprimConfig.ensureDirectories();

    const intervalMs = hprimConfig.pollIntervalMs;
    console.log(`[HPRIM Worker] Starting — polling retour/ every ${intervalMs}ms`);
    console.log(`[HPRIM Worker] Paths: aller=${hprimConfig.allerPath}, retour=${hprimConfig.retourPath}`);

    pollingInterval = setInterval(pollOnce, intervalMs);

    // Run once after a short delay
    setTimeout(pollOnce, 5000);
}

/**
 * Stop the HPRIM inbound worker
 */
export function stopHprimWorker(): void {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[HPRIM Worker] Stopped');
    }
}
