/**
 * Auth Sync Service
 * 
 * Bidirectional sync between tenant auth caches and authoritative Group DBs.
 * Uses inbox/outbox event pattern with BIGSERIAL monotonic cursors.
 * 
 * Mirrors identitySyncService.ts exactly, adapted for auth entities.
 * 
 * Synced entities:
 *   - auth.users        (PK: user_id)
 *   - auth.credentials  (PK: credential_id)
 *   - auth.user_tenants (PK: user_id, tenant_id — composite)
 * 
 * NOT synced: auth.audit_log, public.user_roles, public.user_services
 * 
 * Flow:
 *   syncUp(groupDbName, tenantId)   — Tenant outbox → Group inbox
 *   processInbox(groupDbName)       — Group inbox → auth.* + Group outbox
 *   syncDown(groupDbName, tenantId) — Group outbox → Tenant auth.*
 */

import { groupQuery, getGroupClient } from '../db/groupPg';
import { tenantQuery, getTenantClient } from '../db/tenantPg';
import { PoolClient } from 'pg';

const BATCH_SIZE = 100;

// ─── Entity Configuration ──────────────────────────────────────

const AUTH_ENTITY_TABLES: Record<string, string> = {
    'users': 'auth.users',
    'credentials': 'auth.credentials',
    'user_tenants': 'auth.user_tenants',
};

// PK column(s) per entity — for UPSERT conflict resolution
const AUTH_ENTITY_PK: Record<string, string | string[]> = {
    'users': 'user_id',
    'credentials': 'credential_id',
    'user_tenants': ['user_id', 'tenant_id'],
};

// Columns per entity (for UPSERT)
const AUTH_ENTITY_COLUMNS: Record<string, string[]> = {
    'users': [
        'user_id', 'username', 'first_name', 'last_name', 'display_name',
        'inpe', 'is_active', 'master_patient_id', 'created_at', 'updated_at'
    ],
    'credentials': [
        'credential_id', 'user_id', 'password_hash', 'password_algo',
        'must_change_password', 'last_login_at', 'created_at', 'updated_at'
    ],
    'user_tenants': [
        'user_id', 'tenant_id', 'is_enabled', 'created_at'
    ],
};

// ─── Service ───────────────────────────────────────────────────

export class AuthSyncService {

    // ================================================================
    // SYNC UP: Tenant outbox → Group inbox
    // ================================================================

    async syncUp(groupDbName: string, tenantId: string): Promise<number> {
        // 1. Read unprocessed events from tenant outbox
        const events = await tenantQuery(tenantId, `
            SELECT * FROM auth_sync.outbox_events
            WHERE processed_at IS NULL
            ORDER BY created_at
            LIMIT $1
        `, [BATCH_SIZE]);

        if (events.length === 0) return 0;

        let sent = 0;

        for (const event of events) {
            try {
                // 2. Insert into group inbox (idempotent via UNIQUE constraint)
                await groupQuery(groupDbName, `
                    INSERT INTO auth_sync.inbox_events 
                    (source_tenant_id, entity_type, entity_id, operation, payload, source_event_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (source_tenant_id, source_event_id) DO NOTHING
                `, [
                    tenantId,
                    event.entity_type,
                    event.entity_id,
                    event.operation,
                    event.payload,
                    event.event_id   // tenant's event_id becomes source_event_id
                ]);

                // 3. Mark tenant outbox event as processed
                await tenantQuery(tenantId, `
                    UPDATE auth_sync.outbox_events
                    SET processed_at = NOW()
                    WHERE event_id = $1
                `, [event.event_id]);

                sent++;
            } catch (err: any) {
                console.error(`[AuthSync] syncUp error for event ${event.event_id}:`, err.message);
                // Continue with next event (retry on next cycle)
            }
        }

        if (sent > 0) {
            console.log(`[AuthSync] syncUp(${tenantId}): ${sent}/${events.length} events sent to group`);
        }
        return sent;
    }

    // ================================================================
    // PROCESS INBOX: Group inbox → auth.* + Group outbox
    // Called ONCE per group (not per tenant)
    // ================================================================

    async processInbox(groupDbName: string): Promise<number> {
        // Read unprocessed inbox events
        const events = await groupQuery(groupDbName, `
            SELECT * FROM auth_sync.inbox_events
            WHERE processed_at IS NULL
            ORDER BY created_at
            LIMIT $1
        `, [BATCH_SIZE]);

        if (events.length === 0) return 0;

        let processed = 0;

        for (const event of events) {
            const client = await getGroupClient(groupDbName);
            try {
                await client.query('BEGIN');

                const table = AUTH_ENTITY_TABLES[event.entity_type];
                if (!table) {
                    console.error(`[AuthSync] Unknown entity_type: ${event.entity_type}`);
                    await client.query(`
                        UPDATE auth_sync.inbox_events SET processed_at = NOW() WHERE event_id = $1
                    `, [event.event_id]);
                    await client.query('COMMIT');
                    continue;
                }

                // Apply the event to group auth.* tables (per-entity logic)
                if (event.operation === 'DELETE') {
                    await this.applyDelete(client, event.entity_type, event.entity_id, event.payload);
                } else {
                    await this.applyUpsert(client, event.entity_type, event.payload);
                }

                // Read canonical state after apply
                const canonicalPayload = event.operation === 'DELETE'
                    ? event.payload
                    : await this.readCanonicalRow(client, event.entity_type, event.entity_id, event.payload);

                // Emit canonical event to group outbox
                await client.query(`
                    INSERT INTO auth_sync.outbox_events 
                    (source_tenant_id, entity_type, entity_id, operation, payload)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    event.source_tenant_id,
                    event.entity_type,
                    event.entity_id,
                    event.operation,
                    canonicalPayload || event.payload
                ]);

                // Mark inbox event as processed
                await client.query(`
                    UPDATE auth_sync.inbox_events SET processed_at = NOW() WHERE event_id = $1
                `, [event.event_id]);

                await client.query('COMMIT');
                processed++;
            } catch (err: any) {
                await client.query('ROLLBACK');
                console.error(`[AuthSync] processInbox error for event ${event.event_id}:`, err.message);
            } finally {
                client.release();
            }
        }

        if (processed > 0) {
            console.log(`[AuthSync] processInbox(${groupDbName}): ${processed}/${events.length} events applied`);
        }
        return processed;
    }

    // ================================================================
    // SYNC DOWN: Group outbox → Tenant auth.*
    // ================================================================

    async syncDown(groupDbName: string, tenantId: string): Promise<number> {
        // 1. Get tenant's cursor position (from group tenant_cursors)
        const cursorRows = await groupQuery(groupDbName, `
            SELECT last_outbox_seq FROM auth_sync.tenant_cursors WHERE tenant_id = $1
        `, [tenantId]);

        if (cursorRows.length === 0) {
            // Tenant not registered for sync — skip silently
            return 0;
        }

        const lastSeq = parseInt(cursorRows[0].last_outbox_seq, 10) || 0;

        // 2. Fetch new events from group outbox after cursor
        const events = await groupQuery(groupDbName, `
            SELECT * FROM auth_sync.outbox_events
            WHERE outbox_seq > $1
            ORDER BY outbox_seq
            LIMIT $2
        `, [lastSeq, BATCH_SIZE]);

        if (events.length === 0) return 0;

        let applied = 0;
        let maxSeq = lastSeq;

        for (const event of events) {
            // Skip events that originated from this tenant (avoid echo)
            if (event.source_tenant_id === tenantId) {
                maxSeq = Math.max(maxSeq, parseInt(event.outbox_seq, 10));
                applied++;
                continue;
            }

            const tenantClient = await getTenantClient(tenantId);
            try {
                await tenantClient.query('BEGIN');

                // Set LOCAL flag to suppress triggers (prevent echo loops)
                await tenantClient.query(`SET LOCAL auth_sync.applying = 'true'`);

                const table = AUTH_ENTITY_TABLES[event.entity_type];
                if (!table) {
                    console.error(`[AuthSync] syncDown: unknown entity_type: ${event.entity_type}`);
                    await tenantClient.query('COMMIT');
                    maxSeq = Math.max(maxSeq, parseInt(event.outbox_seq, 10));
                    applied++;
                    continue;
                }

                // Apply the canonical event to tenant auth.*
                if (event.operation === 'DELETE') {
                    await this.applyDelete(tenantClient, event.entity_type, event.entity_id, event.payload);
                } else {
                    await this.applyUpsert(tenantClient, event.entity_type, event.payload);
                }

                // Record in tenant inbox for audit trail (idempotent via PK)
                await tenantClient.query(`
                    INSERT INTO auth_sync.inbox_events 
                    (event_id, source_tenant_id, entity_type, entity_id, operation, payload, applied_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    ON CONFLICT (event_id) DO NOTHING
                `, [
                    event.event_id,
                    event.source_tenant_id,
                    event.entity_type,
                    event.entity_id,
                    event.operation,
                    event.payload
                ]);

                await tenantClient.query('COMMIT');
                maxSeq = Math.max(maxSeq, parseInt(event.outbox_seq, 10));
                applied++;
            } catch (err: any) {
                await tenantClient.query('ROLLBACK');
                console.error(`[AuthSync] syncDown(${tenantId}) error for event ${event.event_id}:`, err.message);
                // Stop processing on error to maintain order
                break;
            } finally {
                tenantClient.release();
            }
        }

        // 3. Advance cursor atomically (on group)
        if (maxSeq > lastSeq) {
            await groupQuery(groupDbName, `
                UPDATE auth_sync.tenant_cursors
                SET last_outbox_seq = $1, updated_at = NOW()
                WHERE tenant_id = $2
            `, [maxSeq, tenantId]);
        }

        if (applied > 0) {
            console.log(`[AuthSync] syncDown(${tenantId}): ${applied} events applied (cursor: ${lastSeq} → ${maxSeq})`);
        }
        return applied;
    }

    // ================================================================
    // PER-ENTITY APPLY HELPERS
    // ================================================================

    /**
     * Apply UPSERT — entity-specific conflict resolution
     */
    private async applyUpsert(client: PoolClient, entityType: string, payload: any): Promise<void> {
        const columns = AUTH_ENTITY_COLUMNS[entityType];
        const table = AUTH_ENTITY_TABLES[entityType];
        const pk = AUTH_ENTITY_PK[entityType];

        if (!columns || !table || !pk) {
            throw new Error(`No mapping for entity: ${entityType}`);
        }

        // Filter to columns present in payload
        const colNames = columns.filter(c => payload[c] !== undefined);
        const placeholders = colNames.map((_, i) => `$${i + 1}`);
        const values = colNames.map(c => payload[c]);

        // Build conflict target
        const pkCols = Array.isArray(pk) ? pk : [pk];
        const conflictTarget = pkCols.join(', ');

        // Build SET clause (exclude PK columns)
        const updateCols = colNames.filter(c => !pkCols.includes(c));
        if (updateCols.length === 0) {
            // No non-PK columns to update — just insert with DO NOTHING
            const sql = `
                INSERT INTO ${table} (${colNames.join(', ')})
                VALUES (${placeholders.join(', ')})
                ON CONFLICT (${conflictTarget}) DO NOTHING
            `;
            await client.query(sql, values);
            return;
        }

        const setClause = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');

        const sql = `
            INSERT INTO ${table} (${colNames.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setClause}
        `;

        await client.query(sql, values);
    }

    /**
     * Apply DELETE — entity-specific PK resolution
     */
    private async applyDelete(client: PoolClient, entityType: string, entityId: string, payload: any): Promise<void> {
        const table = AUTH_ENTITY_TABLES[entityType];
        const pk = AUTH_ENTITY_PK[entityType];

        if (!table || !pk) {
            throw new Error(`No mapping for entity: ${entityType}`);
        }

        if (Array.isArray(pk)) {
            // Composite PK (user_tenants) — parse "uuid1::uuid2" format
            const parts = entityId.split('::');
            if (parts.length !== pk.length) {
                // Fallback: try to extract from payload
                const conditions = pk.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
                const values = pk.map(col => payload[col]);
                await client.query(`DELETE FROM ${table} WHERE ${conditions}`, values);
            } else {
                const conditions = pk.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
                await client.query(`DELETE FROM ${table} WHERE ${conditions}`, parts);
            }
        } else {
            // Simple PK
            await client.query(`DELETE FROM ${table} WHERE ${pk} = $1`, [entityId]);
        }
    }

    /**
     * Read canonical row after apply (for outbox emission)
     */
    private async readCanonicalRow(client: PoolClient, entityType: string, entityId: string, payload: any): Promise<any> {
        const table = AUTH_ENTITY_TABLES[entityType];
        const pk = AUTH_ENTITY_PK[entityType];

        if (!table || !pk) return null;

        if (Array.isArray(pk)) {
            // Composite PK
            const parts = entityId.split('::');
            const conditions = pk.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
            const values = parts.length === pk.length ? parts : pk.map(col => payload[col]);
            const result = await client.query(
                `SELECT to_jsonb(t.*) as payload FROM ${table} t WHERE ${conditions}`, values
            );
            return result.rows[0]?.payload || null;
        } else {
            const result = await client.query(
                `SELECT to_jsonb(t.*) as payload FROM ${table} t WHERE t.${pk} = $1`, [entityId]
            );
            return result.rows[0]?.payload || null;
        }
    }

    // ================================================================
    // DIAGNOSTICS
    // ================================================================

    async getStatus(groupDbName: string): Promise<any> {
        const [groupInbox] = await groupQuery(groupDbName, `
            SELECT 
                COUNT(*) FILTER (WHERE processed_at IS NULL) as pending,
                COUNT(*) as total
            FROM auth_sync.inbox_events
        `);

        const [groupOutbox] = await groupQuery(groupDbName, `
            SELECT COUNT(*) as total, MAX(outbox_seq) as max_seq
            FROM auth_sync.outbox_events
        `);

        const cursors = await groupQuery(groupDbName, `
            SELECT tenant_id, last_outbox_seq, updated_at
            FROM auth_sync.tenant_cursors
            ORDER BY tenant_id
        `);

        return {
            groupDbName,
            group: {
                inbox: { pending: parseInt(groupInbox.pending), total: parseInt(groupInbox.total) },
                outbox: { total: parseInt(groupOutbox.total), maxSeq: parseInt(groupOutbox.max_seq || '0') },
            },
            tenantCursors: cursors.map((c: any) => ({
                tenantId: c.tenant_id,
                lastSeq: parseInt(c.last_outbox_seq),
                updatedAt: c.updated_at,
            })),
        };
    }
}

export const authSyncService = new AuthSyncService();
