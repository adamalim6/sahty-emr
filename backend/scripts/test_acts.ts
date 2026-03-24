import { getTenantPool } from '../db/tenantPg';

async function run() {
  const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
  const pool = getTenantPool(tenantId);
  const client = await pool.connect();
  
  try {
    const res = await client.query(`
      SELECT global_act_id FROM reference.lab_act_contexts LIMIT 5
    `);
    console.log('Sample global act ids in lab_act_contexts:', res.rows);

    if (res.rows.length > 0) {
      const sampleId = res.rows[0].global_act_id;
      const res2 = await client.query(`
        SELECT * FROM reference.lab_analyte_contexts ac
        JOIN reference.lab_act_contexts act_ctx ON act_ctx.analyte_context_id = ac.id
        WHERE act_ctx.global_act_id = $1
      `, [sampleId]);
      console.log(`Resolved analytes for act ${sampleId}:`, res2.rows.length);

      const res3 = await client.query(`
            SELECT DISTINCT
                ac.id, ac.analyte_id, ac.specimen_type_id, ac.unit_id, ac.method_id,
                ac.analyte_label, ac.specimen_label, ac.unit_label, ac.method_label,
                ac.is_default, ac.actif
            FROM reference.lab_analyte_contexts ac
            JOIN reference.lab_act_contexts act_ctx ON act_ctx.analyte_context_id = ac.id
            WHERE act_ctx.global_act_id = ANY($1::uuid[]) AND ac.actif IS NOT FALSE AND act_ctx.actif IS NOT FALSE
      `, [[sampleId]]);
      console.log('Filtered exact repository analytes:', res3.rows.length);
    } else {
      console.log('NO ACT CONTEXTS FOUND IN DB!');
    }
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
