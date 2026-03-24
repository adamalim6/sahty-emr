import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

async function exportCSV() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                la.id,
                la.code,
                la.libelle,
                la.short_label,
                la.description,
                la.value_type,
                u1.code AS default_unit_code,
                u2.code AS canonical_unit_code,
                la.decimal_precision,
                la.is_calculated,
                ssf.code AS sous_famille_code,
                sec.code AS section_code,
                subsec.code AS sub_section_code,
                la.actif,
                la.sort_order
            FROM public.lab_analytes la
            LEFT JOIN public.units u1 ON la.default_unit_id = u1.id
            LEFT JOIN public.units u2 ON la.canonical_unit_id = u2.id
            LEFT JOIN public.sih_sous_familles ssf ON la.sous_famille_id = ssf.id
            LEFT JOIN public.lab_sections sec ON la.section_id = sec.id
            LEFT JOIN public.lab_sub_sections subsec ON la.sub_section_id = subsec.id
            ORDER BY la.sort_order ASC;
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
                if (val.includes(',') || val.includes('"')) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            });
            csvContent += rowValues.join(',') + '\n';
        }
        
        const filePath = '/Users/adamalim/Desktop/lab_analytes_with_uuids.csv';
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
