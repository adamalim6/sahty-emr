/**
 * Identity Sync Worker
 * 
 * Background polling loop that drives bidirectional MPI sync:
 *   1. For each active tenant: syncUp (tenant → central)
 *   2. processInbox (central apply + canonical emit)
 *   3. For each active tenant: syncDown (central → tenant)
 * 
 * Runs on a configurable interval (default 5 seconds).
 */

import { identitySyncService } from '../services/identitySyncService';
import { getActiveTenantIds } from '../db/tenantPg';
import { identityQuery } from '../db/identityPg';

const SYNC_INTERVAL_MS = parseInt(process.env.IDENTITY_SYNC_INTERVAL_MS || '5000');
let isRunning = false;
let intervalHandle: NodeJS.Timeout | null = null;

async function getRegisteredTenantIds(): Promise<string[]> {
    try {
        const rows = await identityQuery(
            `SELECT tenant_id::text FROM identity_sync.tenant_cursors`
        );
        return rows.map((r: any) => r.tenant_id);
    } catch (err: any) {
        // Schema may not exist yet — return empty
        if (err.message?.includes('identity_sync') || err.code === '42P01') {
            return [];
        }
        throw err;
    }
}

async function syncCycle(): Promise<void> {
    if (isRunning) return; // Prevent overlapping cycles
    isRunning = true;

    try {
        // Use registered tenant IDs (from central cursor table)
        // intersected with active pools (tenants that have been accessed this session)
        const registeredIds = await getRegisteredTenantIds();
        const activeIds = getActiveTenantIds();
        
        // Only sync tenants that are both registered AND have an active pool
        const tenantIds = registeredIds.filter(id => activeIds.includes(id));

        if (tenantIds.length === 0) return;

        // Phase 1: Sync UP (all tenants → central)
        for (const tenantId of tenantIds) {
            try {
                await identitySyncService.syncUp(tenantId);
            } catch (err: any) {
                console.error(`[SyncWorker] syncUp(${tenantId}) failed:`, err.message);
            }
        }

        // Phase 2: Process central inbox
        try {
            await identitySyncService.processInbox();
        } catch (err: any) {
            console.error(`[SyncWorker] processInbox failed:`, err.message);
        }

        // Phase 3: Sync DOWN (central → all tenants)
        for (const tenantId of tenantIds) {
            try {
                await identitySyncService.syncDown(tenantId);
            } catch (err: any) {
                console.error(`[SyncWorker] syncDown(${tenantId}) failed:`, err.message);
            }
        }
    } catch (err: any) {
        console.error(`[SyncWorker] Cycle error:`, err.message);
    } finally {
        isRunning = false;
    }
}

export function startIdentitySyncWorker(): void {
    console.log(`[SyncWorker] Starting identity sync worker (interval: ${SYNC_INTERVAL_MS}ms)`);
    intervalHandle = setInterval(syncCycle, SYNC_INTERVAL_MS);
}

export function stopIdentitySyncWorker(): void {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log(`[SyncWorker] Identity sync worker stopped`);
    }
}
