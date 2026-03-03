import { getGlobalPool } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';

const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000001';

async function syncAllTenants() {
    console.log('--- Starting Global-to-Tenant Reference Synchronization ---');
    
    const globalPool = getGlobalPool();
    const globalClient = await globalPool.connect();
    
    let tenants: any[] = [];
    let familles: any[] = [];
    let sousFamilles: any[] = [];
    let actes: any[] = [];

    try {
        console.log("Fetching global source of truth...");
        const resTenants = await globalClient.query(`SELECT id FROM public.tenants`);
        tenants = resTenants.rows;

        const resFam = await globalClient.query(`SELECT id, code, libelle, actif, created_at FROM public.sih_familles`);
        familles = resFam.rows;

        const resSousFam = await globalClient.query(`SELECT id, famille_id, code, libelle, actif, created_at FROM public.sih_sous_familles`);
        sousFamilles = resSousFam.rows;

        const resActes = await globalClient.query(`
            SELECT id, code_sih, libelle_sih, famille_id, sous_famille_id, type_acte, actif, 
            bio_grise, bio_grise_prescription, bio_delai_resultats_heures, bio_cle_facturation, 
            bio_nombre_b, bio_nombre_b1, bio_nombre_b2, bio_nombre_b3, bio_nombre_b4, 
            bio_instructions_prelevement, bio_commentaire, bio_commentaire_prescription, 
            default_specimen_type, is_lims_enabled, lims_template_code, catalog_version
            FROM public.global_actes
        `);
        actes = resActes.rows;
    } finally {
        globalClient.release();
    }

    console.log(`Global Data Loaded: ${familles.length} families, ${sousFamilles.length} sub-families, ${actes.length} acts.`);
    console.log(`Found ${tenants.length} tenants to synchronize.`);

    for (const tenant of tenants) {
        console.log(`\n> Synchronizing Tenant: ${tenant.id}`);
        const pool = getTenantPool(tenant.id);
        const client = await pool.connect();
        
        try {
            await client.query(`SET LOCAL app.user_id = '${SYSTEM_ACTOR}'`);
            await client.query('BEGIN');

            console.log("  Clearing existing tenant reference data...");
            await client.query(`DELETE FROM reference.global_actes`);
            await client.query(`DELETE FROM reference.sih_sous_familles`);
            await client.query(`DELETE FROM reference.sih_familles`);

            console.log("  Inserting Families...");
            for (const f of familles) {
                await client.query(`
                    INSERT INTO reference.sih_familles (id, code, libelle, actif, created_at)
                    VALUES ($1, $2, $3, $4, $5)
                `, [f.id, f.code, f.libelle, f.actif, f.created_at]);
            }

            console.log("  Inserting Sub-Families...");
            for (const sf of sousFamilles) {
                await client.query(`
                    INSERT INTO reference.sih_sous_familles (id, famille_id, code, libelle, actif, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [sf.id, sf.famille_id, sf.code, sf.libelle, sf.actif, sf.created_at]);
            }

            console.log("  Inserting Acts...");
            for (const a of actes) {
                await client.query(`
                    INSERT INTO reference.global_actes (
                        id, code_sih, libelle_sih, famille_id, sous_famille_id, type_acte, actif, 
                        bio_grise, bio_grise_prescription, bio_delai_resultats_heures, bio_cle_facturation, 
                        bio_nombre_b, bio_nombre_b1, bio_nombre_b2, bio_nombre_b3, bio_nombre_b4, 
                        bio_instructions_prelevement, bio_commentaire, bio_commentaire_prescription, 
                        default_specimen_type, is_lims_enabled, lims_template_code, catalog_version
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, 
                        $8, $9, $10, $11, $12, $13, $14, $15, $16, 
                        $17, $18, $19, $20, $21, $22, $23
                    )
                `, [
                    a.id, a.code_sih, a.libelle_sih, a.famille_id, a.sous_famille_id, a.type_acte, a.actif,
                    a.bio_grise, a.bio_grise_prescription, a.bio_delai_resultats_heures, a.bio_cle_facturation,
                    a.bio_nombre_b, a.bio_nombre_b1, a.bio_nombre_b2, a.bio_nombre_b3, a.bio_nombre_b4,
                    a.bio_instructions_prelevement, a.bio_commentaire, a.bio_commentaire_prescription,
                    a.default_specimen_type, a.is_lims_enabled, a.lims_template_code, a.catalog_version
                ]);
            }

            await client.query('COMMIT');
            console.log(`  ✅ Successfully synchronized tenant ${tenant.id}`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`  ❌ Failed synchronizing tenant ${tenant.id}:`, e);
        } finally {
            client.release();
            await pool.end();
        }
    }

    await globalPool.end();
    console.log('\n--- Synchronization Complete ---');
}

syncAllTenants().catch(console.error);
