const { getTenantPool } = require('../db/tenantPg');

async function run() {
  const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
  const pool = getTenantPool(tenantId);
  const client = await pool.connect();
  
  try {
    const res1 = await client.query('SELECT * FROM reference.sih_familles');
    console.log('Familles:', res1.rows);
    
    const res2 = await client.query(`
       SELECT COUNT(*) FROM reference.global_actes ga
       JOIN reference.sih_sous_familles sf ON ga.sous_famille_id = sf.id
       JOIN reference.sih_familles f ON sf.famille_id = f.id
       WHERE f.libelle ILIKE '%BIOLOGIE%' OR f.code ILIKE '%BIOLOGIE%'
    `);
    console.log('Global actes under Biologie famille:', res2.rows);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
