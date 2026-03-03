import { getGlobalPool } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000001';

async function updateTenantSchemas() {
    console.log('--- Starting Safe Tenant Reference Schema Migration ---');
    
    const globalPool = getGlobalPool();
    const globalClient = await globalPool.connect();
    
    let tenants: any[] = [];
    try {
        const res = await globalClient.query(`SELECT id FROM public.tenants`);
        tenants = res.rows;
    } finally {
        globalClient.release();
    }

    console.log(`Found ${tenants.length} tenants:`, tenants.map(t => t.id));

    for (const tenant of tenants) {
        console.log(`\n> Migrating Tenant: ${tenant.id}`);
        const pool = getTenantPool(tenant.id);
        const client = await pool.connect();
        
        try {
            await client.query(`SET LOCAL app.user_id = '${SYSTEM_ACTOR}'`);
            await client.query('BEGIN');

            // 1. Create Taxonomies
            await client.query(`
                CREATE TABLE IF NOT EXISTS reference.sih_familles (
                    id uuid primary key default gen_random_uuid(),
                    code text not null unique,
                    libelle text not null,
                    actif boolean not null default true,
                    created_at timestamptz not null default now()
                );
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS reference.sih_sous_familles (
                    id uuid primary key default gen_random_uuid(),
                    famille_id uuid not null references reference.sih_familles(id) on delete restrict,
                    code text not null,
                    libelle text not null,
                    actif boolean not null default true,
                    created_at timestamptz not null default now(),
                    unique (famille_id, code)
                );
            `);

            // 2. Check and Add Columns safely to global_actes
            // id column
            const idCheck = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='reference' AND table_name='global_actes' AND column_name='id'`);
            if (idCheck.rows.length === 0) {
                await client.query(`ALTER TABLE reference.global_actes ADD COLUMN id uuid DEFAULT gen_random_uuid()`);
                // Drop primary key on code_sih safely if exists
                await client.query(`
                    DO $$ 
                    BEGIN
                      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_actes_pkey' AND connamespace = 'reference'::regnamespace) THEN
                        ALTER TABLE reference.global_actes DROP CONSTRAINT global_actes_pkey CASCADE;
                      END IF;
                    END $$;
                `);
                await client.query(`ALTER TABLE reference.global_actes ADD PRIMARY KEY (id)`);
                await client.query(`ALTER TABLE reference.global_actes ADD CONSTRAINT ref_global_actes_code_sih_key UNIQUE (code_sih)`);
            }

            const columnsToAdd = [
                { name: 'catalog_version', def: 'integer not null default 1' },
                { name: 'famille_id', def: 'uuid references reference.sih_familles(id) on delete set null' },
                { name: 'sous_famille_id', def: 'uuid references reference.sih_sous_familles(id) on delete set null' },
                { name: 'bio_grise', def: 'boolean' },
                { name: 'bio_grise_prescription', def: 'boolean' },
                { name: 'bio_delai_resultats_heures', def: 'integer' },
                { name: 'bio_cle_facturation', def: 'text' },
                { name: 'bio_nombre_b', def: 'integer' },
                { name: 'bio_nombre_b1', def: 'integer' },
                { name: 'bio_nombre_b2', def: 'integer' },
                { name: 'bio_nombre_b3', def: 'integer' },
                { name: 'bio_nombre_b4', def: 'integer' },
                { name: 'bio_instructions_prelevement', def: 'text' },
                { name: 'bio_commentaire', def: 'text' },
                { name: 'bio_commentaire_prescription', def: 'text' },
                { name: 'default_specimen_type', def: 'text' },
                { name: 'is_lims_enabled', def: 'boolean default false' },
                { name: 'lims_template_code', def: 'text' }
            ];

            for (const col of columnsToAdd) {
                const colCheck = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='reference' AND table_name='global_actes' AND column_name=$1`, [col.name]);
                if (colCheck.rows.length === 0) {
                    await client.query(`ALTER TABLE reference.global_actes ADD COLUMN ${col.name} ${col.def}`);
                    console.log(`  Added column ${col.name}`);
                }
            }

            // Clean up mistakenly added triggers if they exist
            await client.query(`
                DO $$ 
                BEGIN
                    DROP TRIGGER IF EXISTS audit_ref_sih_familles ON reference.sih_familles;
                    DROP TRIGGER IF EXISTS audit_ref_sih_sous_familles ON reference.sih_sous_familles;
                    DROP TRIGGER IF EXISTS audit_ref_global_actes ON reference.global_actes;
                END $$;
            `);

            await client.query('COMMIT');
            console.log(`  ✅ Successfully updated schema for tenant ${tenant.id}`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`  ❌ Failed migrating tenant ${tenant.id}:`, e);
        } finally {
            client.release();
            await pool.end(); // close pool for this tenant
        }
    }

    await globalPool.end();
    console.log('\n--- Safe Tenant Reference Schema Migration Complete ---');
}

updateTenantSchemas().catch(console.error);
