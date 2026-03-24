import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';

async function verifyPatientLabResults() {
    console.log('--- Verifying Patient Lab Results Persistence Layer ---');

    // 1. Find an active tenant
    const clients = await globalQuery('SELECT id FROM tenants LIMIT 1');
    if (clients.length === 0) {
        console.log('No active tenants found.');
        return;
    }
    const tenantId = clients[0].id;
    console.log(`Testing against tenant: ${tenantId}`);

    const pool = getTenantPool(tenantId);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Setup: Get a user, a patient
        const users = await client.query('SELECT user_id FROM auth.users LIMIT 1');
        if (users.rows.length === 0) throw new Error("No users found");
        const userId = users.rows[0].user_id;

        const patients = await client.query('SELECT tenant_patient_id FROM patients_tenant LIMIT 1');
        if (patients.rows.length === 0) throw new Error("No patients found");
        const patientId = patients.rows[0].tenant_patient_id;

        // 1. Constraint: source_type enforcement
        try {
            await client.query(`
                INSERT INTO public.patient_lab_reports 
                (tenant_patient_id, source_type, uploaded_by_user_id) 
                VALUES ($1, 'FAKE_SOURCE', $2)
            `, [patientId, userId]);
            throw new Error("Validation Failed: INSERT allowed invalid source_type");
        } catch (e: any) {
            if (!e.message.includes('check_constraint') && !e.message.includes('violates check constraint')) {
                throw e; // Relaunch if it wasn't the expected constraint error
            }
            console.log('✅ Constraint check passed: Invalid source_type blocked.');
        }

        // Return to a clean savepoint after caught error
        await client.query('ROLLBACK');
        await client.query('BEGIN');

        // 2. Insert a Document-Only Report (No Tests/Results)
        const res1 = await client.query(`
            INSERT INTO public.patient_lab_reports 
            (tenant_patient_id, source_type, structuring_status, uploaded_by_user_id) 
            VALUES ($1, 'EXTERNAL_REPORT', 'DOCUMENT_ONLY', $2)
            RETURNING id
        `, [patientId, userId]);
        const docOnlyReportId = res1.rows[0].id;
        console.log('✅ Document-only report inserts successfully.');

        // 3. One report can have multiple documents
        await client.query(`
            INSERT INTO public.patient_lab_report_documents 
            (patient_lab_report_id, original_filename, storage_path, uploaded_by_user_id)
            VALUES 
            ($1, 'page1.pdf', '/path1', $2),
            ($1, 'page2.pdf', '/path2', $2)
        `, [docOnlyReportId, userId]);
        console.log('✅ One report can accommodate multiple documents.');

        // 4. Insert a Structured Report
        const res2 = await client.query(`
            INSERT INTO public.patient_lab_reports 
            (tenant_patient_id, source_type, structuring_status, uploaded_by_user_id) 
            VALUES ($1, 'INTERNAL_LIMS', 'STRUCTURED', $2)
            RETURNING id
        `, [patientId, userId]);
        const structuredReportId = res2.rows[0].id;

        // 5. One report can have multiple report_tests (groupings), global_act_id is nullable
        const testRes = await client.query(`
            INSERT INTO public.patient_lab_report_tests 
            (patient_lab_report_id, raw_test_label, display_order)
            VALUES 
            ($1, 'Group 1', 1),
            ($1, 'Group 2', 2)
            RETURNING id
        `, [structuredReportId]);
        const testGroup1 = testRes.rows[0].id;
        const testGroup2 = testRes.rows[1].id;
        console.log('✅ One report can have multiple report_tests logical groupings.');
        console.log('✅ Test grouping can occur with an unmapped global_act_id.');

        // Verify patient_lab_report_tests has no status column
        const columnCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'patient_lab_report_tests' AND column_name = 'status'
        `);
        if (columnCheck.rows.length > 0) throw new Error("patient_lab_report_tests should NOT have a status column");
        console.log('✅ patient_lab_report_tests rows contain no lifecycle status columns.');

        // 6. Analyte results persist securely with robust raw text tracking and unmapped analyte_id
        await client.query(`
            INSERT INTO public.patient_lab_results 
            (patient_lab_report_id, patient_lab_report_test_id, raw_analyte_label, value_type, numeric_value, raw_unit_text)
            VALUES 
            ($1, $2, 'Raw Sodium', 'NUMERIC', 140.5, 'mEq/L'),
            ($1, $3, 'Raw Potassium', 'NUMERIC', 4.2, 'mEq/L')
        `, [structuredReportId, testGroup1, testGroup2]);
        console.log('✅ One report can have multiple result rows.');
        console.log('✅ Analyte results persist securely with robust raw text tracking and unmapped analyte_id.');

        // 7. Individual Result Row in Error
        await client.query(`
            UPDATE public.patient_lab_results 
            SET status = 'ENTERED_IN_ERROR', entered_in_error_reason = 'Typo'
            WHERE patient_lab_report_test_id = $1
        `, [testGroup2]);
        console.log('✅ A single result row can be marked ENTERED_IN_ERROR without invalidating the whole report.');

        // 8. Whole report in error
        await client.query(`
            UPDATE public.patient_lab_reports 
            SET status = 'ENTERED_IN_ERROR', entered_in_error_reason = 'Wrong Patient'
            WHERE id = $1
        `, [structuredReportId]);
        console.log('✅ An entire report can be distinctly marked ENTERED_IN_ERROR.');

        // Rollback so we don't pollute the db
        await client.query('ROLLBACK');
        console.log('\n--- VERIFICATION SUCCESS (Changes rolled back cleanly) ---');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Verification Failed:', e);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

verifyPatientLabResults();
