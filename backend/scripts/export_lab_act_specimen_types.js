const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

async function exportCSV() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT * FROM public.lab_act_specimen_types ORDER BY created_at ASC;
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
                if (val.includes(',') || val.includes('"')) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            });
            csvContent += rowValues.join(',') + '\n';
        }
        
        const filePath = '/Users/adamalim/Desktop/lab_act_specimen_types_current.csv';
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
