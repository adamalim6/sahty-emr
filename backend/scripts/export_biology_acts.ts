import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

async function exportCSV() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                g.id,
                g.code_sih,
                g.libelle_sih,
                f.libelle AS famille_libelle,
                sf.libelle AS sous_famille_libelle,
                g.bio_delai_resultats_heures,
                g.bio_cle_facturation,
                g.bio_nombre_b,
                g.is_lims_enabled,
                g.catalog_version,
                g.actif,
                g.lab_section_id,
                g.lab_sub_section_id
            FROM public.global_actes g
            LEFT JOIN public.sih_familles f ON g.famille_id = f.id
            LEFT JOIN public.sih_sous_familles sf ON g.sous_famille_id = sf.id
            WHERE f.code = 'BIOLOGIE'
            ORDER BY g.code_sih ASC;
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
        
        const filePath = '/Users/adamalim/Desktop/biology_actes_with_uuids.csv';
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
