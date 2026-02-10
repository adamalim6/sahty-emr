/**
 * Auth Sync Verification Script
 * 
 * Tests the 5 core scenarios for bidirectional auth sync:
 *   1. Tenant → Group (syncUp + processInbox)
 *   2. Group → Tenant (group write + syncDown)
 *   3. Idempotency (run twice, no duplicates)
 *   4. Echo suppression (syncDown does NOT re-emit outbox)
 *   5. Standalone isolation (STANDALONE tenant not synced)
 * 
 * Usage:
 *   npx ts-node scripts/verify_auth_sync.ts
 */

import { authSyncService } from '../services/authSyncService';
import { groupQuery, getGroupClient } from '../db/groupPg';
import { tenantQuery, getTenantClient } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';
import { v4 as uuidv4 } from 'uuid';

// ─── Config ────────────────────────────────────────────────────

let groupDbName: string;
let groupManagedTenantId: string;
let standaloneTenantId: string | null = null;

const TEST_USER_ID = uuidv4();
const TEST_USER_2_ID = uuidv4();
const TEST_CRED_ID = uuidv4();
const TEST_CRED_2_ID = uuidv4();

// ─── Helpers ───────────────────────────────────────────────────

function pass(label: string) { console.log(`  ✅ ${label}`); }
function fail(label: string, detail?: string) { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); }

async function cleanup() {
    try {
        // Clean up test data from group
        await groupQuery(groupDbName, `DELETE FROM auth.credentials WHERE credential_id IN ($1, $2)`, [TEST_CRED_ID, TEST_CRED_2_ID]);
        await groupQuery(groupDbName, `DELETE FROM auth.users WHERE user_id IN ($1, $2)`, [TEST_USER_ID, TEST_USER_2_ID]);
        await groupQuery(groupDbName, `DELETE FROM auth_sync.inbox_events WHERE entity_id IN ($1, $2)`, [TEST_USER_ID, TEST_USER_2_ID]);
        await groupQuery(groupDbName, `DELETE FROM auth_sync.outbox_events WHERE entity_id IN ($1, $2)`, [TEST_USER_ID, TEST_USER_2_ID]);
    } catch (_) { /* ignore */ }

    try {
        // Clean up test data from tenant
        const tenantClient = await getTenantClient(groupManagedTenantId);
        try {
            await tenantClient.query(`SET LOCAL auth_sync.applying = 'true'`);
            await tenantClient.query(`DELETE FROM auth.credentials WHERE credential_id IN ($1, $2)`, [TEST_CRED_ID, TEST_CRED_2_ID]);
            await tenantClient.query(`DELETE FROM auth.users WHERE user_id IN ($1, $2)`, [TEST_USER_ID, TEST_USER_2_ID]);
        } finally { tenantClient.release(); }
        await tenantQuery(groupManagedTenantId, `DELETE FROM auth_sync.outbox_events WHERE entity_id IN ($1, $2)`, [TEST_USER_ID, TEST_USER_2_ID]);
        await tenantQuery(groupManagedTenantId, `DELETE FROM auth_sync.inbox_events WHERE entity_id IN ($1, $2)`, [TEST_USER_ID, TEST_USER_2_ID]);
    } catch (_) { /* ignore */ }
}

// ─── Discovery ─────────────────────────────────────────────────

async function discoverTestTargets() {
    // Find a GROUP_MANAGED tenant with its group db_name
    const managed = await globalQuery(`
        SELECT t.id AS tenant_id, g.db_name
        FROM tenants t
        INNER JOIN groups g ON g.id = t.group_id
        WHERE t.tenancy_mode = 'GROUP_MANAGED'
          AND g.db_name IS NOT NULL
        LIMIT 1
    `);

    if (managed.length === 0) {
        console.error('❌ No GROUP_MANAGED tenants found. Create a group + tenant first.');
        process.exit(1);
    }

    groupDbName = managed[0].db_name;
    groupManagedTenantId = managed[0].tenant_id;

    // Find a STANDALONE tenant (optional — for test 5)
    const standalone = await globalQuery(`
        SELECT id FROM tenants WHERE tenancy_mode = 'STANDALONE' LIMIT 1
    `);
    standaloneTenantId = standalone.length > 0 ? standalone[0].id : null;

    console.log(`\n📋 Test Environment:`);
    console.log(`  Group DB:          ${groupDbName}`);
    console.log(`  GROUP_MANAGED:     ${groupManagedTenantId}`);
    console.log(`  STANDALONE:        ${standaloneTenantId || '(none — test 5 will skip)'}`);
}

// ─── Test 1: Tenant → Group ───────────────────────────────────

async function test1_tenantToGroup() {
    console.log(`\n🧪 Test 1: Tenant → Group (syncUp + processInbox)`);

    // Create user directly in tenant auth.users (triggers emit outbox)
    await tenantQuery(groupManagedTenantId, `
        INSERT INTO auth.users (user_id, username, first_name, last_name, display_name, is_active)
        VALUES ($1, 'test_sync_user_1', 'Sync', 'TestUser', 'Sync TestUser', true)
    `, [TEST_USER_ID]);

    // Verify outbox event was created
    const outboxPre = await tenantQuery(groupManagedTenantId, `
        SELECT * FROM auth_sync.outbox_events WHERE entity_id = $1
    `, [TEST_USER_ID]);

    if (outboxPre.length > 0) {
        pass('Trigger emitted outbox event');
    } else {
        fail('No outbox event from trigger');
        return;
    }

    // Run syncUp
    const sentUp = await authSyncService.syncUp(groupDbName, groupManagedTenantId);
    if (sentUp > 0) {
        pass(`syncUp sent ${sentUp} event(s)`);
    } else {
        fail('syncUp sent 0 events');
        return;
    }

    // Verify group inbox
    const inbox = await groupQuery(groupDbName, `
        SELECT * FROM auth_sync.inbox_events WHERE entity_id = $1
    `, [TEST_USER_ID]);

    if (inbox.length > 0) {
        pass('Event arrived in group inbox');
    } else {
        fail('Event not in group inbox');
        return;
    }

    // Process inbox
    const processedCount = await authSyncService.processInbox(groupDbName);
    if (processedCount > 0) {
        pass(`processInbox processed ${processedCount} event(s)`);
    } else {
        fail('processInbox processed 0 events');
        return;
    }

    // Verify user in group auth.users
    const groupUser = await groupQuery(groupDbName, `
        SELECT * FROM auth.users WHERE user_id = $1
    `, [TEST_USER_ID]);

    if (groupUser.length > 0 && groupUser[0].username === 'test_sync_user_1') {
        pass('User synced to group auth.users');
    } else {
        fail('User not found in group auth.users');
    }

    // Verify canonical outbox event was emitted
    const outbox = await groupQuery(groupDbName, `
        SELECT * FROM auth_sync.outbox_events WHERE entity_id = $1
    `, [TEST_USER_ID]);

    if (outbox.length > 0) {
        pass('Canonical outbox event emitted');
    } else {
        fail('No canonical outbox event');
    }
}

// ─── Test 2: Group → Tenant ───────────────────────────────────

async function test2_groupToTenant() {
    console.log(`\n🧪 Test 2: Group → Tenant (group write + syncDown)`);

    // Create user directly in group auth.users
    const groupClient = await getGroupClient(groupDbName);
    try {
        await groupClient.query('BEGIN');
        await groupClient.query(`
            INSERT INTO auth.users (user_id, username, first_name, last_name, display_name, is_active)
            VALUES ($1, 'test_sync_user_2', 'Group', 'Created', 'Group Created', true)
        `, [TEST_USER_2_ID]);

        // Manually emit outbox event (since group doesn't have triggers)
        await groupClient.query(`
            INSERT INTO auth_sync.outbox_events 
            (source_tenant_id, entity_type, entity_id, operation, payload)
            VALUES (NULL, 'users', $1, 'UPSERT', $2)
        `, [
            TEST_USER_2_ID,
            JSON.stringify({
                user_id: TEST_USER_2_ID,
                username: 'test_sync_user_2',
                first_name: 'Group',
                last_name: 'Created',
                display_name: 'Group Created',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
        ]);

        await groupClient.query('COMMIT');
        pass('User+outbox created in group');
    } catch (err: any) {
        await groupClient.query('ROLLBACK');
        fail('Failed to create user in group', err.message);
        return;
    } finally {
        groupClient.release();
    }

    // Run syncDown
    const applied = await authSyncService.syncDown(groupDbName, groupManagedTenantId);
    if (applied > 0) {
        pass(`syncDown applied ${applied} event(s)`);
    } else {
        fail('syncDown applied 0 events');
        return;
    }

    // Verify user in tenant auth.users
    const tenantUser = await tenantQuery(groupManagedTenantId, `
        SELECT * FROM auth.users WHERE user_id = $1
    `, [TEST_USER_2_ID]);

    if (tenantUser.length > 0 && tenantUser[0].username === 'test_sync_user_2') {
        pass('User synced down to tenant auth.users');
    } else {
        fail('User not found in tenant auth.users');
    }
}

// ─── Test 3: Idempotency ──────────────────────────────────────

async function test3_idempotency() {
    console.log(`\n🧪 Test 3: Idempotency (run twice, no duplicates)`);

    // Run syncUp + processInbox again
    await authSyncService.syncUp(groupDbName, groupManagedTenantId);
    await authSyncService.processInbox(groupDbName);
    await authSyncService.syncDown(groupDbName, groupManagedTenantId);

    // Check no duplicate users
    const groupUsers = await groupQuery(groupDbName, `
        SELECT COUNT(*) as cnt FROM auth.users WHERE user_id = $1
    `, [TEST_USER_ID]);

    if (parseInt(groupUsers[0].cnt) === 1) {
        pass('No duplicates in group after re-run');
    } else {
        fail(`Duplicates in group: count=${groupUsers[0].cnt}`);
    }

    const tenantUsers = await tenantQuery(groupManagedTenantId, `
        SELECT COUNT(*) as cnt FROM auth.users WHERE user_id = $1
    `, [TEST_USER_2_ID]);

    if (parseInt(tenantUsers[0].cnt) === 1) {
        pass('No duplicates in tenant after re-run');
    } else {
        fail(`Duplicates in tenant: count=${tenantUsers[0].cnt}`);
    }
}

// ─── Test 4: Echo Suppression ─────────────────────────────────

async function test4_echoSuppression() {
    console.log(`\n🧪 Test 4: Echo suppression (syncDown does NOT re-emit outbox)`);

    // Count tenant outbox events before last syncDown
    const preCount = await tenantQuery(groupManagedTenantId, `
        SELECT COUNT(*) as cnt FROM auth_sync.outbox_events WHERE entity_id = $1
    `, [TEST_USER_2_ID]);

    // The user_2 was synced down in test 2 — if echo suppression works,
    // there should be NO outbox event for user_2 in the tenant
    if (parseInt(preCount[0].cnt) === 0) {
        pass('No echo outbox event from syncDown (user_2 not in tenant outbox)');
    } else {
        fail(`Echo detected: ${preCount[0].cnt} outbox event(s) for user_2 in tenant`);
    }
}

// ─── Test 5: Standalone Isolation ─────────────────────────────

async function test5_standaloneIsolation() {
    console.log(`\n🧪 Test 5: Standalone tenant isolation`);

    if (!standaloneTenantId) {
        console.log('  ⚠️  Skipped (no STANDALONE tenant available)');
        return;
    }

    // Verify standalone tenant has no cursor in any group
    // syncDown should return 0 for a standalone tenant
    const result = await authSyncService.syncDown(groupDbName, standaloneTenantId);

    if (result === 0) {
        pass('Standalone tenant not synced (no cursor, syncDown=0)');
    } else {
        fail(`Standalone tenant was synced: ${result} events`);
    }
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('     Auth Sync Verification Suite');
    console.log('═══════════════════════════════════════════');

    await discoverTestTargets();
    await cleanup();

    try {
        await test1_tenantToGroup();
        await test2_groupToTenant();
        await test3_idempotency();
        await test4_echoSuppression();
        await test5_standaloneIsolation();

        // Diagnostics
        console.log(`\n📊 Final Status:`);
        const status = await authSyncService.getStatus(groupDbName);
        console.log(JSON.stringify(status, null, 2));
    } finally {
        await cleanup();
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('     Verification Complete');
    console.log('═══════════════════════════════════════════\n');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
