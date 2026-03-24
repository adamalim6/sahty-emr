import { Pool } from 'pg';

async function runAudit() {
    try {
        const tenantDbName = 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895';
        const pool = new Pool({ connectionString: `postgres://sahty:sahty_dev_2026@localhost:5432/${tenantDbName}` });

        console.log(`\n--- TARGET DB: ${tenantDbName} ---\n`);

        const reportChecks = await pool.query(`
            SELECT pg_get_constraintdef(c.oid) as def 
            FROM pg_constraint c 
            JOIN pg_class t ON c.conrelid = t.oid 
            WHERE t.relname = 'patient_lab_reports' AND c.contype = 'c'
        `);
        console.log("patient_lab_reports CHECKS:");
        reportChecks.rows.forEach(r => console.log(r.def));

        const resultChecks = await pool.query(`
            SELECT pg_get_constraintdef(c.oid) as def 
            FROM pg_constraint c 
            JOIN pg_class t ON c.conrelid = t.oid 
            WHERE t.relname = 'patient_lab_results' AND c.contype = 'c'
        `);
        console.log("\npatient_lab_results CHECKS:");
        resultChecks.rows.forEach(r => console.log(r.def));

        const orphans = await pool.query(`
            SELECT COUNT(*) as orphan_count 
            FROM public.patient_lab_results 
            WHERE patient_lab_report_id NOT IN (SELECT id FROM public.patient_lab_reports)
        `);
        console.log("\nOrphan Results: ", orphans.rows[0].orphan_count);

        const duplicates = await pool.query(`
            SELECT patient_lab_report_id, analyte_context_id, COUNT(*) 
            FROM public.patient_lab_results 
            WHERE analyte_context_id IS NOT NULL
            GROUP BY patient_lab_report_id, analyte_context_id 
            HAVING COUNT(*) > 1
        `);
        console.log("Duplicate Analytes per Report: ", duplicates.rows.length);

        const sizes = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM public.patient_lab_reports) as reports_count,
                (SELECT COUNT(*) FROM public.patient_lab_results) as results_count
        `);
        console.log("Total Reports: ", sizes.rows[0].reports_count);
        console.log("Total Results: ", sizes.rows[0].results_count);

        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
runAudit();
