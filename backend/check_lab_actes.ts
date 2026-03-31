import { Pool } from 'pg';

const pool = new Pool({
  user: 'sahty',
  host: 'localhost',
  database: 'sahty_global',
  password: 'sahty_dev_2026',
  port: 5432,
});

async function main() {
  try {
    const schema = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('global_actes', 'lab_panels', 'lab_panel_items')
      ORDER BY table_name, ordinal_position;
    `);
    
    console.log("--- Tables Found ---");
    const grouped = schema.rows.reduce((acc, row) => {
        if (!acc[row.table_name]) acc[row.table_name] = [];
        acc[row.table_name].push(row.column_name);
        return acc;
    }, {});
    console.log(grouped);

    // If tables match expectation, run query
    if (grouped['lab_panels'] && grouped['lab_panel_items']) {
      console.log("\n--- Querying Mappings ---");

      const res2 = await pool.query(`
        SELECT COUNT(DISTINCT ga.id) as unmapped
        FROM global_actes ga
        LEFT JOIN sih_familles f ON ga.famille_id = f.id
        LEFT JOIN lab_panels lp ON lp.global_act_id = ga.id
        LEFT JOIN lab_panel_items lpi ON lpi.panel_id = lp.id
        WHERE f.libelle ILIKE '%BIOLOG%'
        AND lpi.panel_id IS NULL;
      `);
      console.log("Global Biology Acts without any analyte contexts mapped to them:", res2.rows[0].unmapped);
    }
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

main();
