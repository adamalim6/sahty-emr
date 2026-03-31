import 'dotenv/config';
import { getTenantPool } from './db/tenantPg';

async function run() {
    try {
        const pool = getTenantPool('demo');
        const res = await pool.query(`
            SELECT
              p.*,
              cc.label as care_category_label,
              CASE
                WHEN p.stopped_at IS NOT NULL THEN 'STOPPED'
                WHEN p.paused_at IS NOT NULL THEN 'PAUSED'
                WHEN NOT EXISTS (
                  SELECT 1
                  FROM public.prescription_events pe
                  WHERE pe.tenant_id = p.tenant_id
                    AND pe.prescription_id = p.id
                    AND (
                      pe.scheduled_at
                      + (COALESCE(pe.duration, 0) || ' minutes')::interval
                    ) > now()
                ) THEN 'ELAPSED'
                ELSE 'ACTIVE'
              END AS derived_status
            FROM public.prescriptions p
            LEFT JOIN reference.global_dci gd 
                ON p.prescription_type = 'medication' 
                AND gd.id::text = split_part(p.details->>'moleculeId', ',', 1)
            LEFT JOIN reference.care_categories cc 
                ON cc.id = gd.care_category_id
            WHERE p.tenant_id = 'demo'
              AND p.tenant_patient_id = 'cf64ecc6-0be4-4571-b9ea-f460114d0b27'
            ORDER BY p.created_at DESC;
        `);
        console.log("SUCCESS:", res.rowCount);
    } catch(e: any) {
        console.error("FAILURE SQL:", e.message);
    }
    process.exit(0);
}
run();
