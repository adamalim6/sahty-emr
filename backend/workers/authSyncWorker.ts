/**
 * Auth Sync Worker
 * 
 * Background polling loop that drives bidirectional auth sync:
 *   1. For each group: syncUp all its GROUP_MANAGED tenants
 *   2. For each group: processInbox once
 *   3. For each group: syncDown to all its GROUP_MANAGED tenants
 * 
 * Only processes tenants with tenancy_mode = 'GROUP_MANAGED'.
 * Runs on a configurable interval (default 5 seconds).
 * 
 * Mirrors identitySyncWorker.ts, adapted for per-group processing.
 */

import { authSyncService } from '../services/authSyncService';
import { globalQuery } from '../db/globalPg';

const SYNC_INTERVAL_MS = parseInt(process.env.AUTH_SYNC_INTERVAL_MS || '5000');
let isRunning = false;
let intervalHandle: NodeJS.Timeout | null = null;

// ─── Types ─────────────────────────────────────────────────────

interface GroupTenantMapping {
    groupDbName: string;
    tenantIds: string[];
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Discover GROUP_MANAGED tenants, grouped by their group's db_name.
 * Queries sahty_global for tenants joined to groups.
 */
async function getGroupTenantMappings(): Promise<GroupTenantMapping[]> {
    try {
        const rows = await globalQuery(`
            SELECT g.db_name, t.id AS tenant_id
            FROM tenants t
            INNER JOIN groups g ON g.id = t.group_id
            WHERE t.tenancy_mode = 'GROUP_MANAGED'
              AND g.db_name IS NOT NULL
            ORDER BY g.db_name, t.id
        `);

        // Group by db_name
        const grouped = new Map<string, string[]>();
        for (const row of rows) {
            if (!grouped.has(row.db_name)) {
                grouped.set(row.db_name, []);
            }
            grouped.get(row.db_name)!.push(row.tenant_id);
        }

        return Array.from(grouped.entries()).map(([groupDbName, tenantIds]) => ({
            groupDbName,
            tenantIds,
        }));
    } catch (err: any) {
        // Tables may not exist yet — return empty
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
            return [];
        }
        throw err;
    }
}

// ─── Sync Cycle ────────────────────────────────────────────────

async function syncCycle(): Promise<void> {
    if (isRunning) return; // Prevent overlapping cycles
    isRunning = true;

    try {
        const mappings = await getGroupTenantMappings();
        if (mappings.length === 0) return;

        // Process each group independently
        for (const { groupDbName, tenantIds } of mappings) {
            try {
                // Phase 1: Sync UP (all tenants → group)
                for (const tenantId of tenantIds) {
                    try {
                        await authSyncService.syncUp(groupDbName, tenantId);
                    } catch (err: any) {
                        console.error(`[AuthSyncWorker] syncUp(${tenantId}) failed:`, err.message);
                    }
                }

                // Phase 2: Process group inbox (ONCE per group)
                try {
                    await authSyncService.processInbox(groupDbName);
                } catch (err: any) {
                    console.error(`[AuthSyncWorker] processInbox(${groupDbName}) failed:`, err.message);
                }

                // Phase 3: Sync DOWN (group → all tenants)
                for (const tenantId of tenantIds) {
                    try {
                        await authSyncService.syncDown(groupDbName, tenantId);
                    } catch (err: any) {
                        console.error(`[AuthSyncWorker] syncDown(${tenantId}) failed:`, err.message);
                    }
                }
            } catch (err: any) {
                console.error(`[AuthSyncWorker] Group ${groupDbName} cycle error:`, err.message);
            }
        }
    } catch (err: any) {
        console.error(`[AuthSyncWorker] Cycle error:`, err.message);
    } finally {
        isRunning = false;
    }
}

// ─── Public API ────────────────────────────────────────────────

export function startAuthSyncWorker(): void {
    console.log(`[AuthSyncWorker] Starting auth sync worker (interval: ${SYNC_INTERVAL_MS}ms)`);
    intervalHandle = setInterval(syncCycle, SYNC_INTERVAL_MS);
}

export function stopAuthSyncWorker(): void {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log(`[AuthSyncWorker] Auth sync worker stopped`);
    }
}
