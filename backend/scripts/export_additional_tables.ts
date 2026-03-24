import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

async function exportTable(tableName: string, outputFile: string) {
    const client = await pool.connect();
    try {
        const query = `SELECT * FROM public.${tableName} ORDER BY created_at ASC;`;
        const res = await client.query(query);
        if (res.rows.length === 0) return console.log(`0 rows for ${tableName}`);
        
        const headers = Object.keys(res.rows[0]);
        let csvContent = headers.join(',') + '\n';
        
        for (const row of res.rows) {
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
        fs.writeFileSync(outputFile, csvContent);
        console.log(`Successfully exported ${res.rows.length} rows to ${outputFile}`);
    } catch (e) {
        console.error(`Failed exporting ${tableName}:`, e);
    } finally {
        client.release();
    }
}

async function run() {
    await exportTable('lab_analytes', '/Users/adamalim/Desktop/lab_analytes_current_with_uuids.csv');
    await exportTable('lab_specimen_types', '/Users/adamalim/Desktop/lab_specimen_types_current_with_uuids.csv');
    await pool.end();
}

run();
