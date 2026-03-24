const fs = require('fs');
const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const OUT_FILE = '/Users/adamalim/Desktop/current_lab_analytes.csv';

async function main() {
  const client = new Client({ connectionString: GLOBAL_DB });
  try {
    await client.connect();
    
    // Attempting query
    const res = await client.query('SELECT * FROM public.lab_analytes ORDER BY created_at ASC');
    
    if (res.rows.length === 0) {
      console.log('No data found in lab_analytes table.');
      return;
    }

    const headers = Object.keys(res.rows[0]);
    let csvData = headers.join(',') + '\n';

    for (const row of res.rows) {
      const line = headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        if (val instanceof Date) {
          return val.toISOString();
        }
        return val;
      }).join(',');
      csvData += line + '\n';
    }

    fs.writeFileSync(OUT_FILE, csvData);
    console.log(`✅ Successfully exported ${res.rows.length} records to ${OUT_FILE}`);

  } catch (err) {
    console.error('❌ Error executing export:', err.message);
  } finally {
    await client.end();
  }
}

main();
