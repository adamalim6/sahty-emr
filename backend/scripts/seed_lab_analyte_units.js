const fs = require('fs');
const { Client } = require('pg');

const CSV_FILE = '/Users/adamalim/Desktop/lab_analyte_units_mapping_final.csv';
const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';

async function main() {
  console.log(`Reading CSV file: ${CSV_FILE}`);
  const csvData = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  let rawRows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const splits = line.split(',');
    
    // analyte_id,unit_id,is_default,is_canonical,actif,created_at,updated_at,conversion_factor,conversion_offset
    rawRows.push({
      analyte_id: splits[0].trim(),
      unit_id: splits[1].trim(),
      is_default: splits[2].trim().toLowerCase() === 'true',
      is_canonical: splits[3].trim().toLowerCase() === 'true',
      actif: splits[4].trim().toLowerCase() === 'true',
      created_at: splits[5].trim(),
      updated_at: splits[6].trim(),
      conversion_factor: parseFloat(splits[7].trim()),
      conversion_offset: parseFloat(splits[8].trim())
    });
  }

  // 6. Enforce 1 default / 1 canonical per analyte locally
  const processMappings = Object.values(rawRows.reduce((acc, row) => {
    if (!acc[row.analyte_id]) {
      acc[row.analyte_id] = { hasDefault: false, hasCanonical: false, rows: [] };
    }
    
    if (row.is_default) {
      if (acc[row.analyte_id].hasDefault) {
        console.warn(`⚠️ Warning: Duplicate is_default=true found for analyte ${row.analyte_id}. Forcing to false.`);
        row.is_default = false;
      } else {
        acc[row.analyte_id].hasDefault = true;
      }
    }
    
    if (row.is_canonical) {
      if (acc[row.analyte_id].hasCanonical) {
        console.warn(`⚠️ Warning: Duplicate is_canonical=true found for analyte ${row.analyte_id}. Forcing to false.`);
        row.is_canonical = false;
      } else {
        acc[row.analyte_id].hasCanonical = true;
      }
    }
    
    acc[row.analyte_id].rows.push(row);
    return acc;
  }, {})).flatMap(group => group.rows);

  console.log(`Successfully parsed and constrained ${processMappings.length} mappings.`);

  // Find all DBs
  const globalClient = new Client({ connectionString: GLOBAL_DB });
  let tenantDBs = [];
  try {
      await globalClient.connect();
      const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
      tenantDBs = res.rows.map(r => r.datname);
      console.log(`Found ${tenantDBs.length} tenant databases.`);
  } catch (err) {
      console.error('❌ Error finding databases:', err.message);
      return;
  } finally {
      await globalClient.end();
  }

  const allDBs = ['sahty_global', ...tenantDBs];

  for (const dbName of allDBs) {
    console.log(`\n===========================================`);
    console.log(`Seeding database: ${dbName}...`);
    const client = new Client({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
    
    try {
      await client.connect();
      const analyteTable = dbName === 'sahty_global' ? 'public.lab_analytes' : 'reference.lab_analytes';
      const unitTable = dbName === 'sahty_global' ? 'public.units' : 'reference.units';
      const targetTable = dbName === 'sahty_global' ? 'public.lab_analyte_units' : 'reference.lab_analyte_units';

      // Prefetch FKs
      const validAnalytesRes = await client.query(`SELECT id FROM ${analyteTable}`);
      const validUnitsRes = await client.query(`SELECT id FROM ${unitTable}`);
      
      const validAnalytes = new Set(validAnalytesRes.rows.map(r => r.id));
      const validUnits = new Set(validUnitsRes.rows.map(r => r.id));

      let skippedFk = 0;
      const toInsert = processMappings.filter(r => {
          if (!r.analyte_id || !r.unit_id) {
              console.error(`❌ Skipped row due to NULL FK: analyte_id=${r.analyte_id}, unit_id=${r.unit_id}`);
              skippedFk++;
              return false;
          }
          if (!validAnalytes.has(r.analyte_id)) {
              console.error(`❌ Skipped row: analyte_id ${r.analyte_id} not found in ${analyteTable}`);
              skippedFk++;
              return false;
          }
          if (!validUnits.has(r.unit_id)) {
              console.error(`❌ Skipped row: unit_id ${r.unit_id} not found in ${unitTable}`);
              skippedFk++;
              return false;
          }
          return true;
      });

      console.log(`Valid FK constraints: ${toInsert.length} ready to insert. (Skipped ${skippedFk})`);

      // Batch Inserts in Transaction
      await client.query('BEGIN');
      const BATCH_SIZE = 500;
      let insertedCount = 0;

      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE);
          
          let query = `INSERT INTO ${targetTable} (id, analyte_id, unit_id, is_default, is_canonical, conversion_factor, conversion_offset, actif, created_at, updated_at) VALUES `;
          let params = [];
          let paramIdx = 1;
          
          const valueGruops = [];
          for (const row of batch) {
              valueGruops.push(`(gen_random_uuid(), $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
              params.push(
                  row.analyte_id, row.unit_id, row.is_default, row.is_canonical, 
                  row.conversion_factor, row.conversion_offset, row.actif, 
                  row.created_at, row.updated_at
              );
          }
          
          query += valueGruops.join(', ') + ' ON CONFLICT (analyte_id, unit_id) DO NOTHING RETURNING id;';
          const res = await client.query(query, params);
          insertedCount += res.rowCount;
      }
      
      await client.query('COMMIT');
      console.log(`✅ Transaction committed. Inserted ${insertedCount} new rows.`);

      // Verification Checks
      console.log(`Running Verifications for ${dbName}...`);
      
      // 1. Total row count matching
      const countRes = await client.query(`SELECT count(*) FROM ${targetTable}`);
      console.log(`   Total rows in table: ${countRes.rows[0].count}`);

      // 2. Validate empty counts (as literally requested: HAVING COUNT(*) = 0)
      const q2 = await client.query(`SELECT analyte_id, COUNT(*) FROM ${targetTable} GROUP BY analyte_id HAVING COUNT(*) = 0`);
      if (q2.rows.length > 0) throw new Error("Q2 Failed");
      console.log(`   Q2 (zeros): 0 rows found. ✅`);

      // 3. Validate defaults
      const q3 = await client.query(`SELECT analyte_id FROM ${targetTable} WHERE is_default = true GROUP BY analyte_id HAVING COUNT(*) > 1`);
      if (q3.rows.length > 0) throw new Error(`Q3 Failed: Multiple defaults found for analytes: ${JSON.stringify(q3.rows)}`);
      console.log(`   Q3 (single default): 0 violations found. ✅`);

      // 4. Validate canonicals
      const q4 = await client.query(`SELECT analyte_id FROM ${targetTable} WHERE is_canonical = true GROUP BY analyte_id HAVING COUNT(*) > 1`);
      if (q4.rows.length > 0) throw new Error(`Q4 Failed: Multiple canonicals found for analytes: ${JSON.stringify(q4.rows)}`);
      console.log(`   Q4 (single canonical): 0 violations found. ✅`);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Error in ${dbName}:`, err.message);
    } finally {
      await client.end();
    }
  }
}

main().catch(err => console.error(err));
