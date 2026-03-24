const fs = require('fs');
const { Client } = require('pg');

const CSV_FILE = '/Users/adamalim/Desktop/missing_units_extended.csv';
const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';

async function main() {
  console.log('Reading CSV file:', CSV_FILE);
  const csvData = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csvData.trim().split('\n');
  const units = [];
  
  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i].trim();
    if (!line) continue;
    
    // code,display,is_ucum,is_active,sort_order
    const row = line.match(/(".*?"|[^",\s]+|\s+)(?=\s*,|\s*$)/g);
    if (!row) continue;
    
    // Some basic split since no commas inside data in our simple CSV
    const splits = line.split(',');
    if (splits.length >= 5) {
        units.push({
            code: splits[0].trim(),
            display: splits[1].trim(),
            is_ucum: splits[2].trim().toLowerCase() === 'true',
            is_active: splits[3].trim().toLowerCase() === 'true',
            sort_order: parseInt(splits[4].trim(), 10)
        });
    }
  }

  console.log(`Parsed ${units.length} units from CSV.`);

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
      let ignored = 0;
      
      const tableName = dbName === 'sahty_global' ? 'public.units' : 'reference.units';

      for (const u of units) {
        // We use ON CONFLICT (code) DO NOTHING
        const res = await client.query(`
          INSERT INTO ${tableName} (id, code, display, is_ucum, is_active, sort_order, created_at, updated_at) 
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now())
          ON CONFLICT (code) DO NOTHING
          RETURNING id
        `, [u.code, u.display, u.is_ucum, u.is_active, u.sort_order]);
        
        if (res.rowCount > 0) {
            inserted++;
        } else {
            ignored++;
        }
      }
      
      console.log(`✅ Successfully seeded ${dbName} (Inserted: ${inserted}, Ignored (duplicate code): ${ignored})`);
    } catch (err) {
      console.error(`❌ Error seeding ${dbName}:`, err.message);
    } finally {
      await client.end();
    }
  }
}

main().catch(err => console.error(err));
