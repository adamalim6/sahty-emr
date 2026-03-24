import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

function parseCSV(content: string) {
    const lines = content.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const row: Record<string, string> = {};
        
        // simple CSV parser handling quotes
        let inQuotes = false;
        let colIndex = 0;
        let cValue = '';
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row[headers[colIndex]] = cValue.trim();
                colIndex++;
                cValue = '';
            } else {
                cValue += char;
            }
        }
        if (colIndex < headers.length) {
            row[headers[colIndex]] = cValue.trim();
        }
        data.push(row);
    }
    return data;
}

async function run() {
    const client = await pool.connect();
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    try {
        const csvPath = '/Users/adamalim/Desktop/lab_analytes_seed_augmented_university_hospital.csv';
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const rows = parseCSV(csvContent);
        
        console.log(`Found ${rows.length} rows in CSV`);
        
        // Get Maps
        const famRes = await client.query('SELECT id, code FROM public.sih_sous_familles');
        const sousFamMap = new Map<string, string>();
        famRes.rows.forEach(r => sousFamMap.set(r.code, r.id));

        const secRes = await client.query('SELECT id, code FROM public.lab_sections');
        const secMap = new Map<string, string>();
        secRes.rows.forEach(r => secMap.set(r.code, r.id));

        const subSecRes = await client.query('SELECT id, code FROM public.lab_sub_sections');
        const subSecMap = new Map<string, string>();
        subSecRes.rows.forEach(r => subSecMap.set(r.code, r.id));

        const unitRes = await client.query('SELECT id, code FROM public.units');
        const unitMap = new Map<string, string>();
        unitRes.rows.forEach(r => unitMap.set(r.code, r.id));
        
        await client.query('BEGIN');
        
        for (const r of rows) {
            const code = r['code'];
            if (!code) continue;
            
            // Map IDs
            const sfCode = r['sous_famille_code'];
            const secCode = r['section_code'];
            const subSecCode = r['sub_section_code'];
            const dUnitCode = r['default_unit_code'];
            const cUnitCode = r['canonical_unit_code'];
            
            const sous_famille_id = sfCode ? sousFamMap.get(sfCode) || null : null;
            if (!sous_famille_id && sfCode) {
                console.warn(`WARNING: Missing sous_famille_id for code ${sfCode} in analyte ${code}`);
                skipped++; continue;
            }
            
            const section_id = secCode ? secMap.get(secCode) || null : null;
            const sub_section_id = subSecCode ? subSecMap.get(subSecCode) || null : null;
            
            const default_unit_id = dUnitCode ? unitMap.get(dUnitCode) || null : null;
            const canonical_unit_id = cUnitCode ? unitMap.get(cUnitCode) || null : null;
            
            const precisionStr = r['decimal_precision'];
            const precision = precisionStr && precisionStr.trim() !== '' ? parseInt(precisionStr) : null;
            
            const isCalculated = r['is_calculated']?.toLowerCase() === 'true';
            const actif = r['actif']?.toLowerCase() === 'true';
            const sortOrder = parseInt(r['sort_order']) || 0;
            
            try {
                // Check exist
                const exist = await client.query('SELECT id FROM public.lab_analytes WHERE code = $1', [code]);
                if (exist.rows.length === 0) {
                    await client.query(`
                        INSERT INTO public.lab_analytes (
                            code, libelle, short_label, description, value_type, 
                            decimal_precision, is_calculated, actif, sort_order, 
                            sous_famille_id, section_id, sub_section_id, 
                            default_unit_id, canonical_unit_id
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    `, [
                        code, r['libelle'], r['short_label'], r['description'], r['value_type'],
                        precision, isCalculated, actif, sortOrder,
                        sous_famille_id, section_id, sub_section_id,
                        default_unit_id, canonical_unit_id
                    ]);
                    inserted++;
                } else {
                    // Update
                    await client.query(`
                        UPDATE public.lab_analytes SET
                            libelle = $2, short_label = $3, description = $4, value_type = $5,
                            decimal_precision = $6, is_calculated = $7, actif = $8, sort_order = $9,
                            sous_famille_id = $10, section_id = $11, sub_section_id = $12,
                            default_unit_id = $13, canonical_unit_id = $14
                        WHERE code = $1
                    `, [
                        code, r['libelle'], r['short_label'], r['description'], r['value_type'],
                        precision, isCalculated, actif, sortOrder,
                        sous_famille_id, section_id, sub_section_id,
                        default_unit_id, canonical_unit_id
                    ]);
                    inserted++; // Counted as inserted/updated
                }
            } catch (err: any) {
                console.error(`Error processing row ${code}:`, err.message);
                errors++;
            }
        }
        
        await client.query('COMMIT');
        console.log(`Successfully completed. Inserted/Updated: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
        
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Critical Failure:", e);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
