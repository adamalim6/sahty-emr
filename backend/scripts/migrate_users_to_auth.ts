/**
 * migrate_users_to_auth.ts
 * 
 * Migrates existing users from tenant public.users → auth.users + auth.credentials + auth.user_tenants + public.user_roles
 * Preserves original UUIDs.
 * 
 * Usage: npx ts-node scripts/migrate_users_to_auth.ts
 */

import { globalQuery } from '../db/globalPg';
import { tenantQuery } from '../db/tenantPg';

interface PublicUser {
    id: string;
    tenant_id: string;
    username: string;
    password_hash: string;
    nom: string;
    prenom: string;
    user_type: string;
    role_id: string | null;
    inpe: string | null;
    service_ids: string | null;
    active: boolean;
    created_at: string;
}

async function main() {
    console.log('=== Migrate Tenant Users: public.users → auth.* ===\n');

    const tenants = await globalQuery<{ id: string; designation: string }>(
        'SELECT id, designation FROM tenants ORDER BY designation'
    );
    console.log(`Found ${tenants.length} tenant(s) to migrate.\n`);

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
        console.log(`\n━━━ ${tenant.designation} (${tenant.id}) ━━━`);

        // 1. Read existing users from public.users
        const publicUsers = await tenantQuery<PublicUser>(
            tenant.id,
            'SELECT * FROM public.users',
            []
        );
        console.log(`  Found ${publicUsers.length} user(s) in public.users`);

        for (const user of publicUsers) {
            // Check if already migrated
            const existing = await tenantQuery(
                tenant.id,
                'SELECT user_id FROM auth.users WHERE user_id = $1',
                [user.id]
            );

            if (existing.length > 0) {
                console.log(`  ⏭  ${user.username} — already in auth.users`);
                totalSkipped++;
                continue;
            }

            try {
                // 2. Insert into auth.users
                const displayName = `${user.prenom} ${user.nom}`.trim() || user.username;
                await tenantQuery(tenant.id, `
                    INSERT INTO auth.users (user_id, username, first_name, last_name, display_name, inpe, is_active, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), now())
                `, [
                    user.id,
                    user.username,
                    user.prenom || '',
                    user.nom || '',
                    displayName,
                    user.inpe || null,
                    user.active !== false,
                    user.created_at || null
                ]);

                // 3. Insert into auth.credentials
                await tenantQuery(tenant.id, `
                    INSERT INTO auth.credentials (user_id, password_hash, password_algo)
                    VALUES ($1, $2, 'bcrypt')
                `, [user.id, user.password_hash]);

                // 4. Insert into auth.user_tenants
                await tenantQuery(tenant.id, `
                    INSERT INTO auth.user_tenants (user_id, tenant_id, is_enabled)
                    VALUES ($1, $2::uuid, TRUE)
                `, [user.id, tenant.id]);

                // 5. Insert into public.user_roles (if role_id exists)
                if (user.role_id) {
                    await tenantQuery(tenant.id, `
                        INSERT INTO public.user_roles (user_id, role_id)
                        VALUES ($1, $2::uuid)
                        ON CONFLICT DO NOTHING
                    `, [user.id, user.role_id]);
                }

                console.log(`  ✅ ${user.username} → auth.* (role: ${user.role_id ? '✓' : '—'})`);
                totalMigrated++;
            } catch (err: any) {
                console.error(`  ❌ ${user.username}: ${err.message}`);
            }
        }

        // Verify counts
        const authCount = await tenantQuery(tenant.id, 'SELECT COUNT(*) as n FROM auth.users', []);
        const credCount = await tenantQuery(tenant.id, 'SELECT COUNT(*) as n FROM auth.credentials', []);
        const roleCount = await tenantQuery(tenant.id, 'SELECT COUNT(*) as n FROM public.user_roles', []);
        console.log(`  📊 auth.users: ${authCount[0].n}, auth.credentials: ${credCount[0].n}, user_roles: ${roleCount[0].n}`);
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`  Migrated: ${totalMigrated}`);
    console.log(`  Skipped:  ${totalSkipped}`);
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
