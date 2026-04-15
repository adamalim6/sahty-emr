import { Pool } from 'pg';

const GLOBAL_DB_URL = "postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global";
const FORBIDDEN_CODES = ['NORMAL','ABNORMAL','ABNORMAL_LOW','ABNORMAL_HIGH','CAUTION','CAUTION_LOW','CAUTION_HIGH'];

async function checkMigrationSafety() {
    console.log("Running Migration Safety Check: Interpretation Codes usage in Rules");
    
    const globalPool = new Pool({ connectionString: GLOBAL_DB_URL });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    let allSafe = true;

    for (const dbName of tenantDatabases) {
        console.log(`Checking ${dbName}...`);
        const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        
        try {
            const query = `
                SELECT id, canonical_value_id, canonical_value_min_id, canonical_value_max_id 
                FROM lab_reference_rules
                WHERE canonical_value_id IN (
                    SELECT id FROM reference.lab_canonical_allowed_values WHERE code = ANY($1)
                ) OR canonical_value_min_id IN (
                    SELECT id FROM reference.lab_canonical_allowed_values WHERE code = ANY($1)
                ) OR canonical_value_max_id IN (
                    SELECT id FROM reference.lab_canonical_allowed_values WHERE code = ANY($1)
                );
            `;
            const checkRes = await tPool.query(query, [FORBIDDEN_CODES]);
            if ((checkRes.rowCount ?? 0) > 0) {
                console.error(`🚨 ALERT: Found ${checkRes.rowCount} violating rules in ${dbName}`);
                console.table(checkRes.rows);
                allSafe = false;
            } else {
                console.log(`  -> Clean. No violations found.`);
            }
        } catch (e) {
            console.error(`  -> Check failed for ${dbName}:`, e);
            allSafe = false;
        } finally {
            await tPool.end();
        }
    }
    
    if (allSafe) {
        console.log("\n✅ ALL SAFE to proceed with deletion of interpretation canonical values.");
    } else {
        console.log("\n❌ STOP: Violations found. Do not drop codes without fixing rules first.");
        process.exit(1);
    }
}

checkMigrationSafety().catch(console.error);
