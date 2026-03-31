import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";

const CANONICAL_VALUES = [
    // Semi-quantitative
    { code: 'NEGATIVE', label: 'Négatif', domain: 'semi_quantitative', rank: 0 },
    { code: 'TRACE', label: 'Trace', domain: 'semi_quantitative', rank: 1 },
    { code: 'PLUS_1', label: '+', domain: 'semi_quantitative', rank: 2 },
    { code: 'PLUS_2', label: '++', domain: 'semi_quantitative', rank: 3 },
    { code: 'PLUS_3', label: '+++', domain: 'semi_quantitative', rank: 4 },
    { code: 'PLUS_4', label: '++++', domain: 'semi_quantitative', rank: 5 },
    
    // Presence / Absence
    { code: 'PRESENT', label: 'Présent', domain: 'presence_absence', rank: 0 },
    { code: 'ABSENT', label: 'Absent', domain: 'presence_absence', rank: 0 },
    
    // Reactivity
    { code: 'REACTIVE', label: 'Réactif', domain: 'reactivity', rank: 0 },
    { code: 'NON_REACTIVE', label: 'Non Réactif', domain: 'reactivity', rank: 0 },
    
    // Positivity
    { code: 'POSITIVE', label: 'Positif', domain: 'positivity', rank: 0 },
    { code: 'NEGATIVE_POS', label: 'Négatif (Positivité)', domain: 'positivity', rank: 0 } // Avoid code collision with NEGATIVE from semi_quantitative if global uniqueness is required
];

async function applyMigration() {
    console.log("Applying Migration 100: Expand canonical allowed values...");

    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);

    async function seedTable(pool: Pool, schema: string) {
        for (const item of CANONICAL_VALUES) {
            // Check if exists
            const check = await pool.query(`SELECT id FROM ${schema}.lab_canonical_allowed_values WHERE code = $1`, [item.code]);
            if (check.rows.length === 0) {
                await pool.query(`
                    INSERT INTO ${schema}.lab_canonical_allowed_values (id, code, label, value_domain, ordinal_rank, actif)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
                `, [item.code, item.label, item.domain, item.rank]);
            } else {
                await pool.query(`
                    UPDATE ${schema}.lab_canonical_allowed_values
                    SET value_domain = $2, label = $3, ordinal_rank = $4
                    WHERE code = $1
                `, [item.code, item.domain, item.label, item.rank]);
            }
        }
    }

    // 1. Update sahty_global
    try {
        console.log("Seeding sahty_global...");
        await globalPool.query('BEGIN');
        await seedTable(globalPool, 'public');
        await globalPool.query('COMMIT');
        console.log("  -> Global seeded successfully.");
    } catch (e) {
        await globalPool.query('ROLLBACK');
        console.error("Failed global seed:", e);
    } finally {
        await globalPool.end();
    }

    // 2. Update all tenants
    console.log(`\nFound ${tenantDatabases.length} tenant databases. Applying to tenants...`);
    for (const dbName of tenantDatabases) {
        console.log(`Applying to ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            await tPool.query('BEGIN');
            await seedTable(tPool, 'reference');
            await tPool.query('COMMIT');
            console.log(`  -> Success for ${dbName}`);
        } catch (e) {
            await tPool.query('ROLLBACK');
            console.error(`  -> Failed for ${dbName}`, e);
        } finally {
            await tPool.end();
        }
    }

    console.log("\nMigration 100 Complete!");
}

applyMigration().catch(console.error);
