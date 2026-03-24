import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

async function exportCSV() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                id,
                code,
                libelle,
                description,
                actif,
                sort_order,
                created_at,
                updated_at
            FROM public.lab_methods
            ORDER BY sort_order ASC;
        `;
        
        const res = await client.query(query);
        
        if (res.rows.length === 0) {
            console.log('No rows to export.');
            return;
        }
        
        const headers = Object.keys(res.rows[0]);
        let csvContent = headers.join(',') + '\n';
        
        for (const row of res.rows) {
            const rowValues = headers.map(header => {
                let val = row[header];
                if (val === null || val === undefined) return '';
                val = String(val);
                // Escape quotes and wrap in quotes if contains commas or quotes
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            });
            csvContent += rowValues.join(',') + '\n';
        }
        
        const filePath = '/Users/adamalim/Desktop/lab_methods_current_with_uuids.csv';
        fs.writeFileSync(filePath, csvContent);
        console.log(`Successfully exported ${res.rows.length} rows to ${filePath}`);
        
    } catch (e) {
        console.error('Export failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

exportCSV();
