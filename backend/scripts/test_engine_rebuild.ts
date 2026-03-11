import { hydricEngineService } from '../services/hydricEngineService';
import { getTenantPool } from '../db/tenantPg';

async function run() {
    console.log("Rebuilding Hydric Buckets for patient...");
    try {
        await hydricEngineService.rebuildHydricBucketsForPatient(
            'ced91ced-fe46-45d1-8ead-b5d51bad5895',
            '6f537c9a-e7e3-40d8-8659-9c785baa927d'
        );
        console.log("Rebuild completed successfully!");
    } catch (e) {
        console.error("Rebuild failed:", e);
    }

    // Now query the JSON buckets
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const transRes = await pool.query(`
            SELECT *
            FROM surveillance_hour_buckets
            WHERE tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d'
              AND bucket_start >= '2026-03-08T00:00:00Z'
            ORDER BY bucket_start ASC
            LIMIT 10
    `);
    console.log(JSON.stringify(transRes.rows.map(r => ({
        bucket: r.bucket_start,
        values: r.parameter_data || r.values || r.parameter_values
    })), null, 2));

    process.exit(0);
}
run();
