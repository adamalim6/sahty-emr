const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_1'
});

async function test() {
  try {
    let res = await pool.query("SELECT id FROM public.prescriptions WHERE tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d'");
    console.log("Prescriptions count:", res.rows.length);

    // Try joining reference.global_dci just like in prescriptionService
    const q = `
            SELECT
              p.*,
              gd.id as dci_id
            FROM public.prescriptions p
            LEFT JOIN reference.global_dci gd 
                ON p.prescription_type = 'medication' 
                AND gd.id::text = split_part(p.details->>'moleculeId', ',', 1)
            WHERE p.tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d'
    `;
    res = await pool.query(q);
    console.log("Prescriptions joined count:", res.rows.length);

  } catch(e) {
    console.error("SQL Error:", e.message);
  }
  await pool.end();
}
test();
