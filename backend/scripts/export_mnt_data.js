const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });
const DATA_DIR = '/mnt/data';

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
        console.error(`Failed to create ${DATA_DIR}. If you are on Mac without root privileges, /mnt/data might not be writable. Please run with sudo or map a localized directory. Error: ${e.message}`);
        process.exit(1);
    }
}

function writeCsv(filePath, rows) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    let csvContent = headers.join(',') + '\n';
    
    for (const row of rows) {
        const rowValues = headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) return '';
            val = String(val);
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        csvContent += rowValues.join(',') + '\n';
    }
    fs.writeFileSync(filePath, csvContent);
}

function writeJson(filePath, rows) {
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
}

async function exportDumps() {
    const client = await pool.connect();
    try {
        // LAB ACT SPECIMEN TYPES
        const mappingsRes = await client.query('SELECT * FROM public.lab_act_specimen_types ORDER BY sort_order ASC, created_at ASC;');
        const mappingsCsvPath = path.join(DATA_DIR, 'lab_act_specimen_types.csv');
        const mappingsJsonPath = path.join(DATA_DIR, 'lab_act_specimen_types.json');
        
        writeCsv(mappingsCsvPath, mappingsRes.rows);
        writeJson(mappingsJsonPath, mappingsRes.rows);
        console.log(`File written to ${mappingsCsvPath}`);
        console.log(`File written to ${mappingsJsonPath}`);

        // UNITS
        const unitsRes = await client.query('SELECT * FROM public.units ORDER BY code ASC;');
        const unitsCsvPath = path.join(DATA_DIR, 'units.csv');
        const unitsJsonPath = path.join(DATA_DIR, 'units.json');
        
        writeCsv(unitsCsvPath, unitsRes.rows);
        writeJson(unitsJsonPath, unitsRes.rows);
        console.log(`File written to ${unitsCsvPath}`);
        console.log(`File written to ${unitsJsonPath}`);
        
        // Print first 5 rows validation
        console.log('\n--- VALIDATION: FIRST 5 COMPLETED ROWS ---');
        const lines = fs.readFileSync(unitsCsvPath, 'utf8').split('\n');
        for (let i = 0; i < Math.min(6, lines.length); i++) {
            console.log(lines[i]);
        }
        
    } catch (e) {
        console.error('Export failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

exportDumps();
