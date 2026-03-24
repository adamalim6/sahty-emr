const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

function writeCsv(filePath, rows) {
    if (rows.length === 0) {
        console.log(`No rows for ${filePath}`);
        return;
    }
    const headers = Object.keys(rows[0]);
    let csvContent = headers.join(',') + '\n';
    
    for (const row of rows) {
        const rowValues = headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) return '';
            val = String(val);
            if (val.includes(',') || val.includes('"')) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        csvContent += rowValues.join(',') + '\n';
    }
    fs.writeFileSync(filePath, csvContent);
    console.log(`Successfully exported ${rows.length} rows to ${filePath}`);
}

async function exportDumps() {
    const client = await pool.connect();
    try {
        console.log('Extracting lab_act_specimen_types...');
        const mappingsRes = await client.query('SELECT * FROM public.lab_act_specimen_types ORDER BY sort_order ASC, created_at ASC;');
        writeCsv('/Users/adamalim/Desktop/lab_act_specimen_types_updated.csv', mappingsRes.rows);

        console.log('\nExtracting units...');
        const unitsRes = await client.query('SELECT * FROM public.units ORDER BY code ASC;');
        writeCsv('/Users/adamalim/Desktop/units_current.csv', unitsRes.rows);
        
    } catch (e) {
        console.error('Export failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

exportDumps();
