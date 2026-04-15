import { getTenantPool } from '../db/tenantPg';

async function run() {
  const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
  const pool = getTenantPool(tenantId);
  const client = await pool.connect();
  
  try {
    console.log('Testing full UNION ALL');
    let res = await client.query(`
            SELECT 
                'ANALYTE' as type, 
                lac.id, 
                lac.analyte_label as label, 
                lac.method_label, 
                lac.unit_label, 
                lac.specimen_label
            FROM lab_analyte_contexts lac
            WHERE lac.actif IS NOT FALSE
              AND lac.analyte_label ILIKE $1

            UNION ALL

            SELECT 
                'ACT' as type, 
                ga.id, 
                ga.libelle_sih as label, 
                NULL as method_label, 
                NULL as unit_label, 
                NULL as specimen_label
            FROM reference.global_actes ga
            JOIN reference.sih_sous_familles sf ON ga.sous_famille_id = sf.id
            WHERE sf.libelle ILIKE 'BIOLOGIE' 
              AND ga.libelle_sih ILIKE $1
            LIMIT 20;
    `, ['%plaqu%']);
    console.log('UNION results:', res.rows);

  } catch (e: any) {
    console.error('UNION error:', e.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
