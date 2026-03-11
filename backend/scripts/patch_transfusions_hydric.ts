import { Pool } from 'pg';
import { hydricEngineService } from '../services/hydricEngineService';

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        for (const row of res.rows) {
            const dbName = row.datname;
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                await pool.query("BEGIN;");
                
                // Retroactively fix any existing transfusions
                const updateRes = await pool.query(`
                    UPDATE prescription_events 
                    SET requires_fluid_info = true
                    WHERE prescription_id IN (
                        SELECT id FROM prescriptions WHERE prescription_type = 'transfusion'
                    )
                    RETURNING prescription_id
                `);

                // Also we already rebuilt the hydric buckets for the test patient so it's currently correct.
                // But just in case, we can rebuild the hydric buckets for any patient who had a fixed transfusion.
                if (updateRes.rows.length > 0) {
                    const patientRes = await pool.query(`
                        SELECT DISTINCT tenant_patient_id 
                        FROM prescriptions 
                        WHERE id = ANY($1)
                    `, [updateRes.rows.map(r => r.prescription_id)]);

                    const tenantId = dbName.replace('tenant_', '');
                    for (const p of patientRes.rows) {
                        try {
                            await hydricEngineService.rebuildHydricBucketsForPatient(tenantId, p.tenant_patient_id);
                        } catch(e) {
                            console.error("Could not run rebuild instantly for patient:", p.tenant_patient_id);
                        }
                    }
                }

                await pool.query("COMMIT;");
                console.log(`✅ ${dbName}: Retroactively flagged ${updateRes.rows.length} transfusion events for Hydric processing.`);
            } catch (err: any) {
                await pool.query("ROLLBACK;");
                console.error(`❌ ${dbName}: ${err.message}`);
            } finally {
                await pool.end();
            }
        }
    } catch (err: any) {
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}
run();
