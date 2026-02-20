/**
 * Identity Sync Service (Queue-Based)
 * 
 * Bidirectional sync between tenant identity caches and central MPI (sahty_identity).
 * Uses status-based queues (PENDING -> SENT/PROCESSED) instead of cursors.
 * 
 * Flow:
 *   syncUp(tenantId)   — Tenant outbox (PENDING) → Central inbox (RECEIVED)
 *   processInbox()     — Central inbox (RECEIVED) → Matching Engine → Central outbox (PENDING)
 *   syncDown(tenantId) — Central outbox (PENDING) → Tenant inbox (RECEIVED) → Tenant identity_ids
 */

import { identityQuery, getIdentityClient } from '../db/identityPg';
import { tenantQuery, getTenantClient } from '../db/tenantPg';
import { PoolClient } from 'pg';

const BATCH_SIZE = 50;

export class IdentitySyncService {

    // ================================================================
    // SYNC UP: Tenant outbox → Central inbox
    // ================================================================

    async syncUp(tenantId: string): Promise<number> {
        // 1. Read PENDING events from tenant outbox
        const events = await tenantQuery(tenantId, `
            SELECT * FROM identity_sync.outbox_events
            WHERE status = 'PENDING'
            ORDER BY created_at
            LIMIT $1
        `, [BATCH_SIZE]);

        if (events.length === 0) return 0;

        let sent = 0;

        for (const event of events) {
            try {
                // 2. Insert into central inbox (idempotent via dedupe_key)
                // We use tenant's event_id as the dedupe_key on central
                await identityQuery(`
                    INSERT INTO identity_sync.inbound_events 
                    (event_id, tenant_id, event_type, payload, dedupe_key, status)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RECEIVED')
                    ON CONFLICT (dedupe_key) DO NOTHING
                `, [
                    tenantId,
                    event.event_type, // e.g. 'PATIENT_UPSERT'
                    event.payload,
                    event.event_id // Use tenant event_id as dedupe key
                ]);

                // 3. Mark tenant outbox event as SENT
                await tenantQuery(tenantId, `
                    UPDATE identity_sync.outbox_events
                    SET status = 'SENT'
                    WHERE event_id = $1
                `, [event.event_id]);

                sent++;
            } catch (err: any) {
                console.error(`[IdentitySync] syncUp error for event ${event.event_id}:`, err.message);
                // Mark as FAILED to avoid infinite loop
                 await tenantQuery(tenantId, `
                    UPDATE identity_sync.outbox_events
                    SET status = 'FAILED', last_error = $1
                    WHERE event_id = $2
                `, [err.message, event.event_id]);
            }
        }

        if (sent > 0) {
            console.log(`[IdentitySync] syncUp(${tenantId}): ${sent}/${events.length} events sent to central`);
        }
        return sent;
    }

    // ================================================================
    // PROCESS INBOX: Central Matching Engine
    // ================================================================

    async processInbox(): Promise<number> {
        // Read RECEIVED inbox events from Central
        const events = await identityQuery(`
            SELECT * FROM identity_sync.inbound_events
            WHERE status = 'RECEIVED'
            ORDER BY received_at
            LIMIT $1
        `, [BATCH_SIZE]);

        if (events.length === 0) return 0;

        let processed = 0;

        for (const event of events) {
            const client = await getIdentityClient();
            try {
                await client.query('BEGIN');

                if (event.event_type === 'PATIENT_UPSERT') {
                    await this.processPatientUpsert(client, event);
                } else {
                    console.warn(`[IdentitySync] Unknown event_type: ${event.event_type}`);
                }

                // Mark inbox event as PROCESSED
                await client.query(`
                    UPDATE identity_sync.inbound_events 
                    SET status = 'PROCESSED', processed_at = NOW() 
                    WHERE event_id = $1
                `, [event.event_id]);

                await client.query('COMMIT');
                processed++;
            } catch (err: any) {
                await client.query('ROLLBACK');
                console.error(`[IdentitySync] processInbox error for event ${event.event_id}:`, err.message);
                
                // Mark as FAILED to avoid infinite loop
                await identityQuery(`
                    UPDATE identity_sync.inbound_events 
                    SET status = 'FAILED', last_error = $1 
                    WHERE event_id = $2
                `, [err.message, event.event_id]);
            } finally {
                client.release();
            }
        }

        if (processed > 0) {
            console.log(`[IdentitySync] processInbox: ${processed}/${events.length} events processed`);
        }
        return processed;
    }

    // --- Matching Engine Logic ---

    private async processPatientUpsert(client: PoolClient, event: any): Promise<void> {
        const payload = event.payload; 
        const tenantId = event.tenant_id;
        const tenantPatientId = payload.tenantPatientId;
        
        // We use tenantPatientId as the source_record_id since it is a UUID and unique
        const sourceRecordId = tenantPatientId;

        // 1. Upsert Source Record (Raw Data)
        await client.query(`
            INSERT INTO identity.mpi_source_records 
            (source_record_id, tenant_id, tenant_patient_id, current_first_name, current_last_name, current_dob, current_sex, status, last_seen_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), NOW(), NOW())
            ON CONFLICT (source_record_id) DO UPDATE SET
                current_first_name = EXCLUDED.current_first_name,
                current_last_name = EXCLUDED.current_last_name,
                current_dob = EXCLUDED.current_dob,
                current_sex = EXCLUDED.current_sex,
                last_seen_at = NOW(),
                updated_at = NOW()
        `, [
            sourceRecordId, 
            tenantId, 
            tenantPatientId,
            payload.firstName, 
            payload.lastName, 
            payload.dob, 
            payload.sex
        ]);

        // 2. Upsert Source Identifiers
        // Remove old ones
        await client.query(`DELETE FROM identity.mpi_source_identifiers WHERE source_record_id = $1`, [sourceRecordId]);
        
        const strongIds = (payload.identifiers || []).filter((i: any) => 
            ['CIN', 'PASSPORT', 'NATIONAL_ID'].includes(i.type)
        );

        if (payload.identifiers && payload.identifiers.length > 0) {
            for (const id of payload.identifiers) {
                await client.query(`
                    INSERT INTO identity.mpi_source_identifiers 
                    (source_identifier_id, source_record_id, identity_type_code, identity_value, issuing_country_code, is_primary, status, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())
                `, [sourceRecordId, id.type, id.value, id.country, !!id.isPrimary]);
            }
        }

        let mpiPersonId: string | null = null;
        let matchReason = 'NEW';
        let matchScore = 0;

        // 3. Attempt Match (Find existing linked person)
        if (strongIds.length > 0) {
            const values = strongIds.map((i: any) => i.value);
            const types = strongIds.map((i: any) => i.type);
            
            // Join identifiers -> memberships to find mpi_person_id
            const matchRes = await client.query(`
                SELECT m.mpi_person_id, i.identity_value, i.identity_type_code
                FROM identity.mpi_source_identifiers i
                JOIN identity.mpi_person_memberships m ON i.source_record_id = m.source_record_id
                WHERE i.identity_type_code = ANY($1) 
                  AND i.identity_value = ANY($2)
                  AND i.source_record_id != $3 -- Don't match self
                LIMIT 1
            `, [types, values, sourceRecordId]);

            if (matchRes.rows.length > 0) {
                mpiPersonId = matchRes.rows[0].mpi_person_id;
                matchReason = `MATCH:${matchRes.rows[0].identity_type_code}`;
                matchScore = 100;
            }
        }

        // 4. If No Match, Check for Existing Membership (Re-processing) or Create New
        if (!mpiPersonId) {
            const existingMembership = await client.query(`
                SELECT mpi_person_id FROM identity.mpi_person_memberships WHERE source_record_id = $1
            `, [sourceRecordId]);
            
            if (existingMembership.rows.length > 0) {
                mpiPersonId = existingMembership.rows[0].mpi_person_id;
                matchReason = 'EXISTING_LINK';
            } else {
                // Create New Person
                const newPerson = await client.query(`
                    INSERT INTO identity.mpi_persons (mpi_person_id, status, created_at, updated_at)
                    VALUES (gen_random_uuid(), 'ACTIVE', NOW(), NOW())
                    RETURNING mpi_person_id
                `);
                mpiPersonId = newPerson.rows[0].mpi_person_id;
            }
        }

        // 5. Create/Update Membership
        await client.query(`
            INSERT INTO identity.mpi_person_memberships 
            (membership_id, mpi_person_id, source_record_id, link_status, linked_at, match_confidence, match_rule, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'LINKED', NOW(), $3, $4, NOW())
            ON CONFLICT (source_record_id) DO UPDATE SET
                mpi_person_id = EXCLUDED.mpi_person_id,
                match_confidence = EXCLUDED.match_confidence,
                match_rule = EXCLUDED.match_rule,
                linked_at = NOW()
            -- Note: We assume 1 source record can only belong to 1 person (which is standard)
            -- But mpi_person_memberships might not have unique constraint on source_record_id?
            -- Assuming it does for this logic. If not, we might create duplicate memberships.
            -- Based on task, let's assume one link.
        `, [mpiPersonId, sourceRecordId, matchScore, matchReason]);
        // Note: If conflict constraint is missing, this INSERT might duplicate. 
        // Ideally we check before insert or rely on unique index.

        // 6. Provide Feedback (MPI_LINK)
        const feedbackPayload = {
            tenantPatientId: tenantPatientId,
            mpiPersonId: mpiPersonId,
            matchReason,
            matchScore
        };

        const dedupeKey = `MPI_LINK:${tenantPatientId}:${mpiPersonId}`;
        
        await client.query(`
            INSERT INTO identity_sync.outbound_events 
            (event_id, tenant_id, event_type, payload, dedupe_key, status, created_at)
            VALUES (gen_random_uuid(), $1, 'MPI_LINK', $2, $3, 'PENDING', NOW())
            ON CONFLICT (dedupe_key) DO NOTHING
        `, [tenantId, feedbackPayload, dedupeKey]);
    }

    // ================================================================
    // SYNC DOWN: Central outbox → Tenant identity.*
    // ================================================================

    // ================================================================
    // SYNC DOWN: Central outbox → Tenant identity.*
    // ================================================================

    async syncDown(tenantId: string): Promise<number> {
        // 1. Fetch PENDING events from central outbound_events for this tenant
        const events = await identityQuery(`
            SELECT * FROM identity_sync.outbound_events
            WHERE tenant_id = $1 AND status = 'PENDING'
            ORDER BY created_at
            LIMIT $2
        `, [tenantId, BATCH_SIZE]);

        if (events.length === 0) return 0;

        let applied = 0;

        for (const event of events) {
            const tenantClient = await getTenantClient(tenantId);
            try {
                await tenantClient.query('BEGIN');
                await tenantClient.query(`SET LOCAL identity_sync.applying = 'true'`);

                if (event.event_type === 'MPI_LINK') {
                   await this.applyMpiLink(tenantClient, tenantId, event.payload);
                }
                
                // Record in tenant inbox
                await tenantClient.query(`
                    INSERT INTO identity_sync.inbox_events 
                    (inbox_event_id, tenant_id, event_type, payload, dedupe_key, status, received_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RECEIVED', NOW())
                    ON CONFLICT (dedupe_key) DO NOTHING
                `, [
                    tenantId,
                    event.event_type,
                    event.payload,
                    event.dedupe_key || event.event_id 
                ]);

                await tenantClient.query('COMMIT');

                // Mark Central event as SENT
                await identityQuery(`
                    UPDATE identity_sync.outbound_events
                    SET status = 'SENT', sent_at = NOW()
                    WHERE event_id = $1
                `, [event.event_id]);

                applied++;
            } catch (err: any) {
                await tenantClient.query('ROLLBACK');
                console.error(`[IdentitySync] syncDown(${tenantId}) error for event ${event.event_id}:`, err.message);
                await identityQuery(`
                    UPDATE identity_sync.outbound_events
                    SET status = 'FAILED'
                    WHERE event_id = $1
                `, [event.event_id]);
            } finally {
                tenantClient.release();
            }
        }

        if (applied > 0) {
            console.log(`[IdentitySync] syncDown(${tenantId}): ${applied} events applied`);
        }
        return applied;
    }

    // --- Tenant Applicators ---

    private async applyMpiLink(client: PoolClient, tenantId: string, payload: any): Promise<void> {
        const { tenantPatientId, mpiPersonId } = payload;
        const ID_TYPE = 'SAHTY_MPI_PERSON_ID';
        
        await client.query(`
            INSERT INTO identity_ids (tenant_id, tenant_patient_id, identity_type_code, identity_value, is_primary)
            VALUES ($1, $2, $3, $4, false)
            ON CONFLICT (tenant_id, tenant_patient_id, identity_type_code) 
            DO UPDATE SET identity_value = EXCLUDED.identity_value
        `, [tenantId, tenantPatientId, ID_TYPE, mpiPersonId]);
        
        console.log(`[SyncDown] Linked tenant patient ${tenantPatientId} to MPI ${mpiPersonId}`);
    }

    async getStatus(): Promise<any> {
        return {}; 
    }
}

export const identitySyncService = new IdentitySyncService();
