/**
 * Setup Identity Sync
 * 
 * One-time bootstrap script that:
 * 1. Applies identity_sync schema to sahty_identity (central)
 * 2. Discovers all existing tenants
 * 3. Applies identity_sync schema + triggers to each tenant DB
 * 4. Seeds tenant_cursors with conditional logic:
 *    - Empty tenant identity → seed to max(outbox_seq) (skip history)
 *    - Non-empty tenant identity → seed to 0 (full sync-down)
 * 
 * Usage: npx ts-node scripts/setup_identity_sync.ts
 */

import { Client, Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432');
const PG_USER = process.env.PG_USER || 'sahty';
const PG_PASSWORD = process.env.PG_PASSWORD || 'sahty_dev_2026';

async function main() {
    console.log('=== Identity Sync Bootstrap ===\n');

    // ================================================================
    // Step 1: Apply central schema to sahty_identity
    // ================================================================
    console.log('Step 1: Applying central identity_sync schema...');
    
    const identityClient = new Client({
        host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD,
        database: 'sahty_identity'
    });

    try {
        await identityClient.connect();
        
        const centralSql = fs.readFileSync(
            path.join(__dirname, '../migrations/pg/global/setup_identity_sync_central.sql'),
            'utf-8'
        );
        await identityClient.query(centralSql);
        console.log('  ✅ Central identity_sync schema applied.\n');
    } finally {
        await identityClient.end();
    }

    // ================================================================
    // Step 2: Discover existing tenants
    // ================================================================
    console.log('Step 2: Discovering existing tenants...');
    
    const globalClient = new Client({
        host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD,
        database: 'sahty_global'
    });

    let tenants: { id: string; designation: string }[] = [];
    try {
        await globalClient.connect();
        const res = await globalClient.query(`SELECT id, designation FROM public.clients ORDER BY designation`);
        tenants = res.rows;
        console.log(`  Found ${tenants.length} tenant(s): ${tenants.map(t => t.designation).join(', ')}\n`);
    } finally {
        await globalClient.end();
    }

    if (tenants.length === 0) {
        console.log('No tenants found. Done.');
        return;
    }

    // ================================================================
    // Step 3: Apply tenant schema + seed cursors
    // ================================================================
    const tenantSql = fs.readFileSync(
        path.join(__dirname, '../../migrations/pg/tenant/028_identity_sync_tenant.sql'),
        'utf-8'
    );

    // Get current max outbox_seq from central (for conditional seeding)
    const identityPool = new Pool({
        host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD,
        database: 'sahty_identity'
    });

    let maxOutboxSeq = 0;
    try {
        const seqRes = await identityPool.query(
            `SELECT COALESCE(MAX(outbox_seq), 0) as max_seq FROM identity_sync.outbox_events`
        );
        maxOutboxSeq = parseInt(seqRes.rows[0].max_seq, 10);
        console.log(`  Current central outbox max_seq: ${maxOutboxSeq}\n`);
    } catch {
        console.log('  No outbox events yet (max_seq = 0)\n');
    }

    for (const tenant of tenants) {
        const dbName = `tenant_${tenant.id}`;
        console.log(`Step 3: Processing tenant "${tenant.designation}" (${dbName})...`);

        const tenantClient = new Client({
            host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD,
            database: dbName
        });

        try {
            await tenantClient.connect();

            // Apply identity_sync schema + triggers
            await tenantClient.query(tenantSql);
            console.log(`  ✅ identity_sync schema applied to ${dbName}`);

            // Check if tenant has identity data
            const countRes = await tenantClient.query(
                `SELECT COUNT(*) as cnt FROM identity.master_patients`
            );
            const patientCount = parseInt(countRes.rows[0].cnt, 10);

            // Conditional cursor seeding
            let seedSeq: number;
            if (patientCount === 0) {
                // Empty tenant → skip history, start from current position
                seedSeq = maxOutboxSeq;
                console.log(`  Empty identity (0 patients) → seeding cursor to ${seedSeq} (skip history)`);
            } else {
                // Non-empty tenant → full sync-down needed
                seedSeq = 0;
                console.log(`  Non-empty identity (${patientCount} patients) → seeding cursor to 0 (full sync-down)`);
            }

            // Register/update cursor in central
            await identityPool.query(`
                INSERT INTO identity_sync.tenant_cursors (tenant_id, last_outbox_seq, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (tenant_id) DO UPDATE SET last_outbox_seq = $2, updated_at = NOW()
            `, [tenant.id, seedSeq]);

            console.log(`  ✅ Cursor registered for tenant ${tenant.id}\n`);

        } catch (err: any) {
            console.error(`  ❌ Error processing tenant "${tenant.designation}":`, err.message);
        } finally {
            await tenantClient.end();
        }
    }

    await identityPool.end();
    console.log('\n=== Identity Sync Bootstrap Complete ===');
}

main().catch(err => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
});
