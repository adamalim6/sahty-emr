import { getTenantPool } from '../db/tenantPg';

async function run() {
  const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
  const pool = getTenantPool(tenantId);
  const client = await pool.connect();
  
  try {
    console.log('Testing raw analyte_label ILIKE %plaqu%');
    let res1 = await client.query(`
      SELECT analyte_label, actif FROM reference.lab_analyte_contexts 
      WHERE analyte_label ILIKE $1
    `, ['%plaqu%']);
    console.log('Analytes matching plaqu:', res1.rows);

    console.log('Testing with actif IS NOT FALSE');
    let res2 = await client.query(`
      SELECT analyte_label FROM reference.lab_analyte_contexts 
      WHERE actif IS NOT FALSE AND analyte_label ILIKE $1
    `, ['%plaqu%']);
    console.log('Analytes active matching plaqu:', res2.rows);

    console.log('Testing sih_sous_familles');
    let res3 = await client.query(`
      SELECT libelle, code FROM reference.sih_sous_familles LIMIT 5
    `);
    console.log('Sous Familles available:', res3.rows);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
