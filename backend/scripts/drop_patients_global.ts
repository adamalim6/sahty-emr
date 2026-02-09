import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function main() {
    const dbName = `tenant_${TENANT_ID}`;
    const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });

    // 1. Apply migration 027
    const migrationPath = path.join(__dirname, '../../migrations/pg/tenant/027_remove_public_roles.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await pool.query(sql);
    console.log('✅ Migration 027 applied');

    // 2. Verify public.roles does NOT exist
    const publicRolesCheck = await pool.query(`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'roles'
        ) AS exists
    `);
    console.log(`public.roles exists: ${publicRolesCheck.rows[0].exists}`);

    // 3. Verify reference.global_roles EXISTS and is populated
    const refRoles = await pool.query('SELECT id, code, name FROM reference.global_roles');
    console.log(`reference.global_roles rows: ${refRoles.rows.length}`);
    refRoles.rows.forEach(r => console.log(`  - ${r.code}: ${r.name} (${r.id})`));

    // 4. Verify ADMIN_STRUCTURE role exists
    const adminStruct = await pool.query("SELECT id FROM reference.global_roles WHERE code = 'ADMIN_STRUCTURE'");
    console.log(`ADMIN_STRUCTURE found: ${adminStruct.rows.length > 0} (id: ${adminStruct.rows[0]?.id})`);

    await pool.end();
}
main().catch(console.error);
