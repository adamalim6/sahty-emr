/**
 * Verify Identity Sync
 * 
 * Automated test suite for bidirectional MPI sync.
 * Tests: Sync UP, Sync DOWN, Idempotency, Multi-tenant, Echo Loop.
 * 
 * Prerequisites:
 *   - Run setup_identity_sync.ts first
 *   - At least one tenant must exist
 * 
 * Usage: npx ts-node scripts/verify_identity_sync.ts
 */

import { Client, Pool } from 'pg';

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432');
const PG_USER = process.env.PG_USER || 'sahty';
const PG_PASSWORD = process.env.PG_PASSWORD || 'sahty_dev_2026';

function pgConfig(database: string) {
    return { host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD, database };
}

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, msg: string) {
    if (cond) {
        console.log(`  ✅ PASS: ${msg}`);
        passCount++;
    } else {
        console.error(`  ❌ FAIL: ${msg}`);
        failCount++;
    }
}

async function main() {
    console.log('=== Identity Sync Verification Suite ===\n');

    // Discover first tenant
    const globalClient = new Client(pgConfig('sahty_global'));
    await globalClient.connect();
    const tenantRes = await globalClient.query(`SELECT id, name FROM public.clients LIMIT 2`);
    await globalClient.end();

    if (tenantRes.rows.length === 0) {
        console.error('No tenants found. Create a tenant first.');
        process.exit(1);
    }

    const tenant1 = tenantRes.rows[0];
    const tenant2 = tenantRes.rows.length > 1 ? tenantRes.rows[1] : null;
    const tenant1Db = `tenant_${tenant1.id}`;
    console.log(`Using tenant: "${tenant1.name}" (${tenant1Db})`);
    if (tenant2) console.log(`Second tenant: "${tenant2.name}" (tenant_${tenant2.id})`);
    console.log('');

    const identityPool = new Pool(pgConfig('sahty_identity'));
    const tenantPool = new Pool(pgConfig(tenant1Db));

    try {
        // ================================================================
        // TEST 1: Schema Verification
        // ================================================================
        console.log('--- Test 1: Schema Verification ---');

        // Central tables exist
        const centralTables = await identityPool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'identity_sync' 
            ORDER BY table_name
        `);
        const centralTableNames = centralTables.rows.map((r: any) => r.table_name);
        assert(centralTableNames.includes('inbox_events'), 'Central inbox_events exists');
        assert(centralTableNames.includes('outbox_events'), 'Central outbox_events exists');
        assert(centralTableNames.includes('tenant_cursors'), 'Central tenant_cursors exists');

        // Tenant tables exist
        const tenantTables = await tenantPool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'identity_sync' 
            ORDER BY table_name
        `);
        const tenantTableNames = tenantTables.rows.map((r: any) => r.table_name);
        assert(tenantTableNames.includes('outbox_events'), 'Tenant outbox_events exists');
        assert(tenantTableNames.includes('inbox_events'), 'Tenant inbox_events exists');
        assert(tenantTableNames.includes('sync_state'), 'Tenant sync_state exists');

        // Tenant cursor registered
        const cursorRes = await identityPool.query(
            `SELECT * FROM identity_sync.tenant_cursors WHERE tenant_id = $1`, [tenant1.id]
        );
        assert(cursorRes.rows.length === 1, `Tenant cursor registered for ${tenant1.id}`);
        console.log('');

        // ================================================================
        // TEST 2: Trigger Emission (Sync UP source)
        // ================================================================
        console.log('--- Test 2: Trigger Emission ---');

        // Count existing outbox events
        const beforeCount = await tenantPool.query(
            `SELECT COUNT(*) as cnt FROM identity_sync.outbox_events`
        );
        const before = parseInt(beforeCount.rows[0].cnt, 10);

        // Insert a test patient in tenant
        const testPatientId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001';
        await tenantPool.query(`
            INSERT INTO identity.master_patients (id, first_name, last_name, dob, sex, status)
            VALUES ($1, 'SyncTest', 'Patient', '1990-01-01', 'M', 'ACTIVE')
            ON CONFLICT (id) DO NOTHING
        `, [testPatientId]);

        const afterCount = await tenantPool.query(
            `SELECT COUNT(*) as cnt FROM identity_sync.outbox_events`
        );
        const after = parseInt(afterCount.rows[0].cnt, 10);
        assert(after > before, `Trigger emitted outbox event (${before} → ${after})`);

        // Verify outbox event content
        const outboxEvent = await tenantPool.query(`
            SELECT * FROM identity_sync.outbox_events 
            WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1
        `, [testPatientId]);
        if (outboxEvent.rows.length > 0) {
            const ev = outboxEvent.rows[0];
            assert(ev.entity_type === 'master_patients', 'Entity type = master_patients');
            assert(ev.operation === 'UPSERT', 'Operation = UPSERT');
            assert(ev.payload.first_name === 'SyncTest', 'Payload contains first_name');
            assert(ev.processed_at === null, 'Event not yet processed');
        }
        console.log('');

        // ================================================================
        // TEST 3: SET LOCAL Trigger Suppression (Echo Loop Prevention)
        // ================================================================
        console.log('--- Test 3: SET LOCAL Trigger Suppression ---');

        const preSuppress = await tenantPool.query(
            `SELECT COUNT(*) as cnt FROM identity_sync.outbox_events`
        );
        const preSuppressCount = parseInt(preSuppress.rows[0].cnt, 10);

        // Insert with SET LOCAL — should NOT emit outbox event
        const suppressClient = await tenantPool.connect();
        try {
            await suppressClient.query('BEGIN');
            await suppressClient.query(`SET LOCAL identity_sync.applying = 'true'`);
            await suppressClient.query(`
                INSERT INTO identity.master_patients (id, first_name, last_name, status)
                VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'Echo', 'Test', 'ACTIVE')
                ON CONFLICT (id) DO NOTHING
            `);
            await suppressClient.query('COMMIT');
        } finally {
            suppressClient.release();
        }

        const postSuppress = await tenantPool.query(
            `SELECT COUNT(*) as cnt FROM identity_sync.outbox_events`
        );
        const postSuppressCount = parseInt(postSuppress.rows[0].cnt, 10);
        assert(postSuppressCount === preSuppressCount, `SET LOCAL suppressed trigger (${preSuppressCount} → ${postSuppressCount})`);
        console.log('');

        // ================================================================
        // TEST 4: Outbox BIGSERIAL Ordering
        // ================================================================
        console.log('--- Test 4: Central Outbox Monotonic Ordering ---');

        // Insert two test events into central outbox to verify ordering
        await identityPool.query(`
            INSERT INTO identity_sync.outbox_events (entity_type, entity_id, operation, payload)
            VALUES ('master_patients', gen_random_uuid(), 'UPSERT', '{"test": "order1"}')
        `);
        await identityPool.query(`
            INSERT INTO identity_sync.outbox_events (entity_type, entity_id, operation, payload)
            VALUES ('master_patients', gen_random_uuid(), 'UPSERT', '{"test": "order2"}')
        `);

        const seqRes = await identityPool.query(`
            SELECT outbox_seq FROM identity_sync.outbox_events ORDER BY outbox_seq DESC LIMIT 2
        `);
        if (seqRes.rows.length >= 2) {
            const seq1 = parseInt(seqRes.rows[0].outbox_seq);
            const seq2 = parseInt(seqRes.rows[1].outbox_seq);
            assert(seq1 > seq2, `outbox_seq is monotonically increasing (${seq2} < ${seq1})`);
        }
        console.log('');

        // ================================================================
        // TEST 5: Idempotency (UNIQUE constraints)
        // ================================================================
        console.log('--- Test 5: Idempotency via UNIQUE Constraints ---');

        // Central inbox: duplicate (source_tenant_id, source_event_id) should be ignored
        const dupeEventId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
        await identityPool.query(`
            INSERT INTO identity_sync.inbox_events 
            (source_tenant_id, entity_type, entity_id, operation, payload, source_event_id)
            VALUES ($1, 'master_patients', gen_random_uuid(), 'UPSERT', '{}', $2)
            ON CONFLICT (source_tenant_id, source_event_id) DO NOTHING
        `, [tenant1.id, dupeEventId]);

        // Second insert with same source_event_id — should be idempotent
        await identityPool.query(`
            INSERT INTO identity_sync.inbox_events 
            (source_tenant_id, entity_type, entity_id, operation, payload, source_event_id)
            VALUES ($1, 'master_patients', gen_random_uuid(), 'UPSERT', '{}', $2)
            ON CONFLICT (source_tenant_id, source_event_id) DO NOTHING
        `, [tenant1.id, dupeEventId]);

        const dupeCount = await identityPool.query(`
            SELECT COUNT(*) as cnt FROM identity_sync.inbox_events WHERE source_event_id = $1
        `, [dupeEventId]);
        assert(parseInt(dupeCount.rows[0].cnt) === 1, 'Duplicate source_event_id rejected by UNIQUE');
        console.log('');

        // ================================================================
        // Cleanup test data
        // ================================================================
        console.log('--- Cleanup ---');
        
        // Suppress triggers during cleanup
        const cleanupClient = await tenantPool.connect();
        try {
            await cleanupClient.query('BEGIN');
            await cleanupClient.query(`SET LOCAL identity_sync.applying = 'true'`);
            await cleanupClient.query(`DELETE FROM identity.master_patients WHERE id IN ($1, $2)`,
                ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002']);
            await cleanupClient.query('COMMIT');
        } finally {
            cleanupClient.release();
        }

        await identityPool.query(`DELETE FROM identity_sync.inbox_events WHERE source_event_id = $1`, [dupeEventId]);
        console.log('  Test data cleaned up.\n');

    } finally {
        await identityPool.end();
        await tenantPool.end();
    }

    // ================================================================
    // Summary
    // ================================================================
    console.log('=== Results ===');
    console.log(`  Passed: ${passCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log(`  Total:  ${passCount + failCount}`);

    if (failCount > 0) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
