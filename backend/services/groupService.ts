/**
 * Group Service
 * 
 * CRUD operations for the public.groups table in sahty_global.
 * On group creation, also provisions a group_<id> database
 * with auth.users, auth.credentials, auth.user_tenants, auth.audit_log.
 */

import { Pool, Client } from 'pg';
import { globalQuery, globalQueryOne, getGlobalClient } from '../db/globalPg';

// ─── Interfaces ────────────────────────────────────────────────

export interface Group {
    id: string;
    name: string;
    hosting_mode: 'SAHTY_HOSTED' | 'GROUP_HOSTED';
    description: string | null;
    db_name: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateGroupInput {
    name: string;
    hosting_mode: 'SAHTY_HOSTED' | 'GROUP_HOSTED';
    description?: string;
}

export interface UpdateGroupInput {
    name?: string;
    hosting_mode?: 'SAHTY_HOSTED' | 'GROUP_HOSTED';
    description?: string;
}

// ─── Auth DB DDL ───────────────────────────────────────────────

const AUTH_SCHEMA_DDL = `
CREATE SCHEMA IF NOT EXISTS auth;

-- 1) auth.users
CREATE TABLE IF NOT EXISTS auth.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    inpe TEXT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    master_patient_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) auth.credentials
CREATE TABLE IF NOT EXISTS auth.credentials (
    credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'bcrypt',
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- 3) auth.user_tenants
CREATE TABLE IF NOT EXISTS auth.user_tenants (
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tenant_id)
);

-- 4) auth.audit_log
CREATE TABLE IF NOT EXISTS auth.audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NULL,
    action TEXT NOT NULL,
    target_user_id UUID NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// ─── Service ───────────────────────────────────────────────────

class GroupService {
    private static instance: GroupService;

    /** Admin pool — connects to a base DB (not the target) to run CREATE DATABASE */
    private adminPool: Pool;

    private constructor() {
        this.adminPool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: process.env.PG_DB || 'sahty_emr'   // base DB for admin commands
        });
    }

    static getInstance(): GroupService {
        if (!GroupService.instance) {
            GroupService.instance = new GroupService();
        }
        return GroupService.instance;
    }

    // ── Reads ────────────────────────────────────────────────

    async listGroups(): Promise<Group[]> {
        return globalQuery<Group>(
            `SELECT * FROM public.groups ORDER BY name`
        );
    }

    async getGroupById(id: string): Promise<Group | null> {
        return globalQueryOne<Group>(
            `SELECT * FROM public.groups WHERE id = $1`,
            [id]
        );
    }

    // ── Create (with Group DB provisioning) ──────────────────

    async createGroup(data: CreateGroupInput): Promise<Group> {
        // Step 1: Insert group row to get its UUID
        const globalClient = await getGlobalClient();
        let group: Group;
        let dbName: string;
        let dbCreated = false;

        try {
            await globalClient.query('BEGIN');

            const insertRes = await globalClient.query(
                `INSERT INTO public.groups (name, hosting_mode, description)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [data.name, data.hosting_mode, data.description || null]
            );
            group = insertRes.rows[0];

            // Step 2: Derive DB name — group_<uuid_with_underscores>
            const safeId = group.id.replace(/-/g, '_');
            dbName = `group_${safeId}`;

            // Commit the group row first — CREATE DATABASE cannot run inside a transaction
            await globalClient.query('COMMIT');
        } catch (err) {
            await globalClient.query('ROLLBACK');
            throw err;
        } finally {
            globalClient.release();
        }

        try {
            // Step 3: Create the group database
            console.log(`[GroupService] Creating group database: ${dbName}`);
            const checkRes = await this.adminPool.query(
                "SELECT 1 FROM pg_database WHERE datname = $1",
                [dbName]
            );

            if (checkRes.rows.length === 0) {
                await this.adminPool.query(`CREATE DATABASE "${dbName}"`);
                dbCreated = true;
                console.log(`[GroupService] Database ${dbName} created.`);
            } else {
                console.log(`[GroupService] Database ${dbName} already exists.`);
                dbCreated = true;
            }

            // Step 4: Connect to the new DB and apply auth schema
            const authClient = new Client({
                host: process.env.PG_HOST || 'localhost',
                port: parseInt(process.env.PG_PORT || '5432'),
                user: process.env.PG_USER || 'sahty',
                password: process.env.PG_PASSWORD || 'sahty_dev_2026',
                database: dbName
            });

            try {
                await authClient.connect();
                await authClient.query(AUTH_SCHEMA_DDL);
                console.log(`[GroupService] Auth schema applied to ${dbName}.`);

                // Apply auth_sync schema (inbox/outbox/cursors for bidirectional sync)
                const authSyncFile = require('path').join(__dirname, '../migrations/pg/group/setup_auth_sync_group.sql');
                const fs = require('fs');
                if (fs.existsSync(authSyncFile)) {
                    const authSyncSql = fs.readFileSync(authSyncFile, 'utf-8');
                    await authClient.query(authSyncSql);
                    console.log(`[GroupService] Auth sync schema applied to ${dbName}.`);
                }
            } finally {
                await authClient.end();
            }

            // Step 5: Update the group row with db_name
            const updateRes = await globalQuery<Group>(
                `UPDATE public.groups SET db_name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
                [dbName, group.id]
            );
            group = updateRes[0];

            console.log(`[GroupService] Group "${group.name}" created with DB: ${dbName}`);
            return group;

        } catch (err: any) {
            // Rollback: delete the group row and drop the DB if it was created
            console.error(`[GroupService] DB provisioning failed for group ${group.id}: ${err.message}`);

            try {
                await globalQuery('DELETE FROM public.groups WHERE id = $1', [group.id]);
                console.log(`[GroupService] Rolled back group row ${group.id}`);
            } catch (cleanupErr: any) {
                console.error(`[GroupService] Failed to clean up group row: ${cleanupErr.message}`);
            }

            if (dbCreated) {
                try {
                    await this.adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
                    console.log(`[GroupService] Dropped DB ${dbName}`);
                } catch (dropErr: any) {
                    console.error(`[GroupService] Failed to drop DB: ${dropErr.message}`);
                }
            }

            throw new Error(`Group creation failed: ${err.message}`);
        }
    }

    // ── Update ───────────────────────────────────────────────

    async updateGroup(id: string, data: UpdateGroupInput): Promise<Group> {
        const sets: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (data.name !== undefined) {
            sets.push(`name = $${idx++}`);
            values.push(data.name);
        }
        if (data.hosting_mode !== undefined) {
            sets.push(`hosting_mode = $${idx++}`);
            values.push(data.hosting_mode);
        }
        if (data.description !== undefined) {
            sets.push(`description = $${idx++}`);
            values.push(data.description);
        }

        sets.push(`updated_at = NOW()`);
        values.push(id);

        const rows = await globalQuery<Group>(
            `UPDATE public.groups SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (rows.length === 0) {
            throw new Error('Group not found');
        }
        return rows[0];
    }

    // ── Delete (with DB cleanup) ─────────────────────────────

    async deleteGroup(id: string): Promise<void> {
        // Fetch group to get db_name before deleting
        const group = await this.getGroupById(id);

        await globalQuery('DELETE FROM public.groups WHERE id = $1', [id]);

        // Drop the group DB if it existed
        if (group?.db_name) {
            try {
                await this.adminPool.query(`DROP DATABASE IF EXISTS "${group.db_name}"`);
                console.log(`[GroupService] Dropped DB ${group.db_name}`);
            } catch (err: any) {
                console.error(`[GroupService] Warning: failed to drop DB ${group.db_name}: ${err.message}`);
            }
        }
    }
}

export const groupService = GroupService.getInstance();
