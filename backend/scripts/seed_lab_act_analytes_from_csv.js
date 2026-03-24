const fs = require('fs');
const { Client } = require('pg');

const CSV_FILE = '/Users/adamalim/Desktop/lab_act_analyte_mapping_full_nonpanel.csv';
const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';

async function main() {
  console.log('Reading CSV file:', CSV_FILE);
  const csvData = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csvData.trim().split('\n');
  const mappings = [];
  
  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i].trim();
    if (!line) continue;
    
    // global_act_id,global_act_name,analyte_id,analyte_code,is_primary,is_required,mapping_basis
    // Dealing with commas inside quotes if any, though our CSV seems to have simple structure mostly
    // We can use a simple regex split for CSV to handle quoted fields safely.
    const row = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    
    if (row && row.length >= 6) {
      let isPrimary = false;
      let isRequired = false;
      
      // Some row indices might shift if quotes are parsed weirdly, let's just use simple split as there are no commas in UUIDs/booleans.
      const splits = line.split(',');
      if (splits.length >= 6) {
          const global_act_id = splits[0].trim();
          const analyte_id = splits[2].trim();
          const is_primary_str = splits[4].trim().toLowerCase();
          const is_required_str = splits[5].trim().toLowerCase();
          
          if (global_act_id.length === 36 && analyte_id.length === 36) { // basic UUID check
              mappings.push({
                  global_act_id,
                  analyte_id,
                  is_primary: is_primary_str === 'true',
                  is_required: is_required_str === 'true'
              });
          }
      }
    }
  }

  console.log(`Parsed ${mappings.length} mappings from CSV.`);

  // Find all DBs
  console.log("Looking for tenant databases...");
  const globalClient = new Client({ connectionString: GLOBAL_DB });
  let tenantDBs = [];
  try {
      await globalClient.connect();
      const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
      tenantDBs = res.rows.map(r => r.datname);
      console.log(`Found ${tenantDBs.length} tenant databases:`, tenantDBs);
  } catch (err) {
      console.error('❌ Error finding databases:', err.message);
      return;
  } finally {
      await globalClient.end();
  }

  const allDBs = ['sahty_global', ...tenantDBs];

  for (const dbName of allDBs) {
    console.log(`\nSeeding database: ${dbName}...`);
    const client = new Client({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
    
    try {
      await client.connect();
      
      let inserted = 0;
      let updated = 0;

      for (const m of mappings) {
        const tableName = dbName === 'sahty_global' ? 'public.lab_act_analytes' : 'reference.lab_act_analytes';

        // Check if exists
        const checkRes = await client.query(
          `SELECT id FROM ${tableName} WHERE global_act_id = $1 AND analyte_id = $2`,
          [m.global_act_id, m.analyte_id]
        );

        if (checkRes.rows.length > 0) {
          // Update
          await client.query(
            `UPDATE ${tableName} SET is_primary = $1, is_required = $2, updated_at = now() WHERE id = $3`,
            [m.is_primary, m.is_required, checkRes.rows[0].id]
          );
          updated++;
        } else {
          // Insert
          await client.query(
            `INSERT INTO ${tableName} (global_act_id, analyte_id, is_primary, is_required) VALUES ($1, $2, $3, $4)`,
            [m.global_act_id, m.analyte_id, m.is_primary, m.is_required]
          );
          inserted++;
        }
      }
      console.log(`✅ Successfully seeded ${dbName} (Inserted: ${inserted}, Updated: ${updated})`);
    } catch (err) {
      console.error(`❌ Error seeding ${dbName}:`, err.message);
    } finally {
      await client.end();
    }
  }
}

main().catch(err => console.error(err));
