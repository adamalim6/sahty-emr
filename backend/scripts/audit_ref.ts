import { Pool } from 'pg';

const globalPool = new Pool({ connectionString: "postgres://sahty:sahty_dev_2026@localhost:5432/sahty_global" });

async function runAudit() {
    try {
        const { rows: tenants } = await globalPool.query('SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1');
        if (tenants.length === 0) throw new Error("No tenants");
        
        const tenantDbName = `tenant_${tenants[0].id}`;
        const tenantPool = new Pool({ connectionString: `postgres://sahty:sahty_dev_2026@localhost:5432/${tenantDbName}` });

        console.log(`\n\n--- TARGET DB: ${tenantDbName} ---\n`);

        const coverage = await tenantPool.query(`
            SELECT 
                COUNT(ac.id) as total_analytes,
                COUNT(DISTINCT p.analyte_context_id) as covered_analytes
            FROM reference.lab_analyte_contexts ac
            LEFT JOIN reference.lab_reference_profiles p ON p.analyte_context_id = ac.id
        `);
        console.log("1.2 DATA COMPLETENESS");
        console.log("Total Analytes Contexts: ", coverage.rows[0].total_analytes);
        console.log("Covered Analytes (with at least 1 profile): ", coverage.rows[0].covered_analytes);

        const profiles = await tenantPool.query(`
            SELECT COUNT(id) as total_profiles FROM reference.lab_reference_profiles
        `);
        
        const ruleCoverage = await tenantPool.query(`
            SELECT 
                COUNT(DISTINCT profile_id) as profiles_with_rules,
                COUNT(id) as total_rules
            FROM reference.lab_reference_rules
        `);
        console.log("\nTotal Profiles: ", profiles.rows[0].total_profiles);
        console.log("Profiles With Rules: ", ruleCoverage.rows[0].profiles_with_rules);
        console.log("Total Rules: ", ruleCoverage.rows[0].total_rules);

        const ruleTypes = await tenantPool.query(`
            SELECT DISTINCT rule_type, interpretation
            FROM reference.lab_reference_rules
            ORDER BY rule_type ASC
        `);
        console.log("\n1.3 RULE TYPES & INTERPRETATIONS");
        console.table(ruleTypes.rows);

        const units = await tenantPool.query(`
            SELECT COUNT(*) as missing_units
            FROM reference.lab_analyte_contexts
            WHERE unit_label IS NULL OR unit_label = ''
        `);
        console.log("\n1.4 MISSING UNITS: ", units.rows[0].missing_units);

        // 4. Edge cases check
        const overlappingProfiles = await tenantPool.query(`
            SELECT analyte_context_id, sex, COUNT(*)
            FROM reference.lab_reference_profiles
            GROUP BY analyte_context_id, sex
            HAVING COUNT(*) > 1
            LIMIT 5
        `);
        console.log("\n4. OVERLAPPING PROFILES (Sample): ", overlappingProfiles.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
runAudit();
