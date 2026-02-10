/**
 * Identity Sync Service
 * 
 * Bidirectional sync between tenant identity caches and central MPI (sahty_identity).
 * Uses inbox/outbox event pattern with BIGSERIAL monotonic cursors.
 * 
 * Flow:
 *   syncUp(tenantId)   — Tenant outbox → Central inbox
 *   processInbox()     — Central inbox → identity.* + central outbox
 *   syncDown(tenantId) — Central outbox → Tenant inbox → tenant identity.*
 */

import { identityQuery, identityTransaction, getIdentityClient } from '../db/identityPg';
import { tenantQuery, tenantTransaction, getTenantClient } from '../db/tenantPg';
import { PoolClient } from 'pg';

const BATCH_SIZE = 100;

// Entity types that map to identity.* tables
const ENTITY_TABLES: Record<string, string> = {
    'master_patients': 'identity.master_patients',
    'master_patient_documents': 'identity.master_patient_documents',
    'master_patient_aliases': 'identity.master_patient_aliases',
    'master_patient_merge_events': 'identity.master_patient_merge_events',
};

// Columns per entity (for UPSERT conflict resolution)
const ENTITY_COLUMNS: Record<string, string[]> = {
    'master_patients': [
        'id', 'first_name', 'last_name', 'dob', 'sex',
        'nationality_code', 'status', 'created_at', 'updated_at'
    ],
    'master_patient_documents': [
        'id', 'master_patient_id', 'document_type_code', 'document_number',
        'issuing_country_code', 'is_primary', 'created_at', 'updated_at'
    ],
    'master_patient_aliases': [
        'id', 'master_patient_id', 'first_name', 'last_name',
        'source', 'created_at'
    ],
    'master_patient_merge_events': [
        'id', 'survivor_master_patient_id', 'merged_master_patient_id',
        'merged_at', 'merged_by', 'reason'
    ],
};

export class IdentitySyncService {

    // ================================================================
    // SYNC UP: Tenant outbox → Central inbox
    // ================================================================

    async syncUp(tenantId: string): Promise<number> {
        // 1. Read unprocessed events from tenant outbox
        const events = await tenantQuery(tenantId, `
            SELECT * FROM identity_sync.outbox_events
            WHERE processed_at IS NULL
            ORDER BY created_at
            LIMIT $1
        `, [BATCH_SIZE]);

        if (events.length === 0) return 0;

        let sent = 0;

        for (const event of events) {
            try {
                // 2. Insert into central inbox (idempotent via UNIQUE constraint)
                await identityQuery(`
                    INSERT INTO identity_sync.inbox_events 
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
                    UPDATE identity_sync.outbox_events
                    SET processed_at = NOW()
                    WHERE event_id = $1
                `, [event.event_id]);

                sent++;
            } catch (err: any) {
                console.error(`[IdentitySync] syncUp error for event ${event.event_id}:`, err.message);
                // Continue with next event (retry on next cycle)
            }
        }

        if (sent > 0) {
            console.log(`[IdentitySync] syncUp(${tenantId}): ${sent}/${events.length} events sent to central`);
        }
        return sent;
    }

    // ================================================================
    // PROCESS INBOX: Central inbox → identity.* + central outbox
    // ================================================================

    async processInbox(): Promise<number> {
        // Read unprocessed inbox events
        const events = await identityQuery(`
            SELECT * FROM identity_sync.inbox_events
            WHERE processed_at IS NULL
            ORDER BY created_at
            LIMIT $1
        `, [BATCH_SIZE]);

        if (events.length === 0) return 0;

        let processed = 0;

        for (const event of events) {
            const client = await getIdentityClient();
            try {
                await client.query('BEGIN');

                const table = ENTITY_TABLES[event.entity_type];
                if (!table) {
                    console.error(`[IdentitySync] Unknown entity_type: ${event.entity_type}`);
                    await client.query(`
                        UPDATE identity_sync.inbox_events SET processed_at = NOW() WHERE event_id = $1
                    `, [event.event_id]);
                    await client.query('COMMIT');
                    continue;
                }

                // Apply the event to central identity.* tables
                if (event.operation === 'DELETE') {
                    await this.applyDelete(client, table, event.entity_id);
                } else {
                    // UPSERT
                    await this.applyUpsert(client, table, event.entity_type, event.payload);
                }

                // Emit canonical event to central outbox
                // Read the authoritative row state after apply
                const canonicalPayload = event.operation === 'DELETE'
                    ? event.payload  // For deletes, keep original payload
                    : await this.readCanonicalRow(client, table, event.entity_id);

                await client.query(`
                    INSERT INTO identity_sync.outbox_events 
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
                    UPDATE identity_sync.inbox_events SET processed_at = NOW() WHERE event_id = $1
                `, [event.event_id]);

                await client.query('COMMIT');
                processed++;
            } catch (err: any) {
                await client.query('ROLLBACK');
                console.error(`[IdentitySync] processInbox error for event ${event.event_id}:`, err.message);
            } finally {
                client.release();
            }
        }

        if (processed > 0) {
            console.log(`[IdentitySync] processInbox: ${processed}/${events.length} events applied to central`);
        }
        return processed;
    }

    // ================================================================
    // SYNC DOWN: Central outbox → Tenant identity.*
    // ================================================================

    async syncDown(tenantId: string): Promise<number> {
        // 1. Get tenant's cursor position (from central tenant_cursors)
        const cursorRows = await identityQuery(`
            SELECT last_outbox_seq FROM identity_sync.tenant_cursors WHERE tenant_id = $1
        `, [tenantId]);

        if (cursorRows.length === 0) {
            // Tenant not registered for sync — skip silently
            return 0;
        }

        const lastSeq = parseInt(cursorRows[0].last_outbox_seq, 10) || 0;

        // 2. Fetch new events from central outbox after cursor
        const events = await identityQuery(`
            SELECT * FROM identity_sync.outbox_events
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
                await tenantClient.query(`SET LOCAL identity_sync.applying = 'true'`);

                const table = ENTITY_TABLES[event.entity_type];
                if (!table) {
                    console.error(`[IdentitySync] syncDown: unknown entity_type: ${event.entity_type}`);
                    await tenantClient.query('COMMIT');
                    continue;
                }

                // Apply the canonical event to tenant identity.*
                if (event.operation === 'DELETE') {
                    await this.applyDelete(tenantClient, table, event.entity_id);
                } else {
                    await this.applyUpsert(tenantClient, table, event.entity_type, event.payload);
                }

                // Record in tenant inbox for audit trail (idempotent via PK)
                await tenantClient.query(`
                    INSERT INTO identity_sync.inbox_events 
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
                console.error(`[IdentitySync] syncDown(${tenantId}) error for event ${event.event_id}:`, err.message);
                // Stop processing on error to maintain order
                break;
            } finally {
                tenantClient.release();
            }
        }

        // 3. Advance cursor atomically (on central)
        if (maxSeq > lastSeq) {
            await identityQuery(`
                UPDATE identity_sync.tenant_cursors
                SET last_outbox_seq = $1, updated_at = NOW()
                WHERE tenant_id = $2
            `, [maxSeq, tenantId]);
        }

        if (applied > 0) {
            console.log(`[IdentitySync] syncDown(${tenantId}): ${applied} events applied (cursor: ${lastSeq} → ${maxSeq})`);
        }
        return applied;
    }

    // ================================================================
    // HELPERS
    // ================================================================

    /**
     * Apply UPSERT to a target table using payload JSONB
     */
    private async applyUpsert(client: PoolClient, table: string, entityType: string, payload: any): Promise<void> {
        const columns = ENTITY_COLUMNS[entityType];
        if (!columns) throw new Error(`No column mapping for entity: ${entityType}`);

        const colNames = columns.filter(c => payload[c] !== undefined);
        const placeholders = colNames.map((_, i) => `$${i + 1}`);
        const values = colNames.map(c => payload[c]);

        // Build SET clause for conflict (exclude 'id')
        const updateCols = colNames.filter(c => c !== 'id');
        const setClause = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');

        const sql = `
            INSERT INTO ${table} (${colNames.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT (id) DO UPDATE SET ${setClause}
        `;

        await client.query(sql, values);
    }

    /**
     * Apply DELETE to a target table
     */
    private async applyDelete(client: PoolClient, table: string, entityId: string): Promise<void> {
        await client.query(`DELETE FROM ${table} WHERE id = $1`, [entityId]);
    }

    /**
     * Read the current canonical row after applying an event
     */
    private async readCanonicalRow(client: PoolClient, table: string, entityId: string): Promise<any> {
        const result = await client.query(`SELECT to_jsonb(t.*) as payload FROM ${table} t WHERE t.id = $1`, [entityId]);
        return result.rows[0]?.payload || null;
    }

    // ================================================================
    // DIAGNOSTICS
    // ================================================================

    async getStatus(): Promise<any> {
        const [centralInbox] = await identityQuery(`
            SELECT 
                COUNT(*) FILTER (WHERE processed_at IS NULL) as pending,
                COUNT(*) as total
            FROM identity_sync.inbox_events
        `);

        const [centralOutbox] = await identityQuery(`
            SELECT COUNT(*) as total, MAX(outbox_seq) as max_seq
            FROM identity_sync.outbox_events
        `);

        const cursors = await identityQuery(`
            SELECT tenant_id, last_outbox_seq, updated_at
            FROM identity_sync.tenant_cursors
            ORDER BY tenant_id
        `);

        return {
            central: {
                inbox: { pending: parseInt(centralInbox.pending), total: parseInt(centralInbox.total) },
                outbox: { total: parseInt(centralOutbox.total), maxSeq: parseInt(centralOutbox.max_seq || '0') },
            },
            tenantCursors: cursors.map((c: any) => ({
                tenantId: c.tenant_id,
                lastSeq: parseInt(c.last_outbox_seq),
                updatedAt: c.updated_at,
            })),
        };
    }
}

export const identitySyncService = new IdentitySyncService();
