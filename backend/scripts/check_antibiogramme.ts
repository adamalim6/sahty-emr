import { getTenantPool } from '../db/tenantPg';

async function run() {
  const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
  const pool = getTenantPool(tenantId);
  const client = await pool.connect();
  
  try {
    const res = await client.query(`
      SELECT ga.id, ga.libelle_sih 
      FROM reference.global_actes ga
      WHERE ga.libelle_sih ILIKE '%antibiogramme%'
    `);
    console.log('Antibiogramme tests:', res.rows);

    if (res.rows.length > 0) {
      const actId = res.rows[0].id;
      const actId2 = res.rows[1]?.id;

      const res2 = await client.query(`
        SELECT COUNT(*)
        FROM lab_act_contexts
        WHERE global_act_id = ANY($1::uuid[])
      `, [[actId, actId2].filter(Boolean)]);
      console.log('Lab act contexts mapped to these acts:', res2.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
